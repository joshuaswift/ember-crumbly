import Component from '@ember/component';
import { copy } from 'ember-copy';
import { assert } from '@ember/debug';
import { deprecate } from '@ember/application/deprecations';
import { typeOf, isPresent } from '@ember/utils';
import {
  setProperties,
  computed,
  get
} from '@ember/object';
import { getOwner } from '@ember/application';
import { A as emberArray } from '@ember/array';
import { classify } from '@ember/string';
import layout from '../templates/components/bread-crumbs';
import { inject as service } from '@ember/service';

const {
  bool,
  readOnly
} = computed;

export default Component.extend({
  layout,
  tagName: 'ol',
  linkable: true,
  reverse: false,
  classNameBindings: ['breadCrumbClass'],
  hasBlock: bool('template').readOnly(),
  routing: service('-routing'),
  currentUrl: readOnly('applicationRoute.router.url'),
  router: service('router'),

  routeHierarchy: computed('currentUrl', 'currentRouteName', 'reverse', {
    get() {
      get(this, 'currentUrl');
    
      let currentRouteName = get(this.router, 'currentRouteName');
      if (currentRouteName === undefined) {
        currentRouteName = false
      }

      assert('[ember-crumbly] Could not find a current route', currentRouteName);

      const routeNames = currentRouteName.split('.');
      const filteredRouteNames = this._filterIndexAndLoadingRoutes(routeNames);
      const crumbs = this._lookupBreadCrumb(routeNames, filteredRouteNames);

      return get(this, 'reverse') ? crumbs.reverse() : crumbs;
    }
  }).readOnly(),

  breadCrumbClass: computed('outputStyle', {
    get() {
      let className = 'breadcrumb';
      let outputStyle = get(this, 'outputStyle');
      if (outputStyle === undefined) {
        outputStyle = ''
      }
      if (isPresent(outputStyle)) {
        deprecate('outputStyle option will be deprecated in the next major release', false, { id: 'ember-crumbly.outputStyle', until: '2.0.0' });
      }
      const lowerCaseOutputStyle = outputStyle.toLowerCase();

      if (lowerCaseOutputStyle === 'foundation') {
        className = 'breadcrumbs';
      }

      return className;
    }
  }).readOnly(),

  _guessRoutePath(routeNames, name, index) {
    const routes = routeNames.slice(0, index + 1);

    if (routes.length === 1) {
      let path = `${name}.index`;

      return (this._lookupRoute(path)) ? path : name;
    }

    return routes.join('.');
  },

  _filterIndexAndLoadingRoutes(routeNames) {
    return routeNames.filter((name) => !(name === 'index' || name === 'loading'));
  },

  /*
   * Lookup local route first and fallback to engine,
   * I'm not exactly familiar with local vs engine routes,
   * but my thinking is you should be able to override an
   * engine route locally so it should take priority.
   * I could be totally wrong here...
   */
   _lookupRoute(routeName) {
     return this._lookupLocalRoute(routeName) || this._lookupEngineRoute(routeName);
   },

   _lookupLocalRoute(routeName) {
     return getOwner(this).lookup(`route:${routeName}`);
   },

   _lookupEngineRoute(routeName) {
     const router = get(this, 'routing.router');

     let engineInfo = router._engineInfoByRoute[routeName];

     if (!engineInfo) {
       return;
     }

     return router
       ._getEngineInstance(engineInfo)
       .lookup(`route:${engineInfo.localFullName}`);
   },

  _lookupBreadCrumb(routeNames, filteredRouteNames) {
    const defaultLinkable = get(this, 'linkable');
    const pathLength = filteredRouteNames.length;
    const breadCrumbs = emberArray();

    filteredRouteNames.map((name, index) => {
      let path = this._guessRoutePath(routeNames, name, index);
      const route = this._lookupRoute(path);
      const isHead = index === 0;
      const isTail = index === pathLength - 1;

      const crumbLinkable = (index === pathLength - 1) ? false : defaultLinkable;

      assert(`[ember-crumbly] \`route:${path}\` was not found`, route);

      const multipleBreadCrumbs = route.get('breadCrumbs');

      if (multipleBreadCrumbs) {
        multipleBreadCrumbs.forEach((breadCrumb) => {
          breadCrumbs.pushObject(breadCrumb);
        });
      } else {
        let breadCrumbRoute = get(route, 'breadCrumb');
        if (breadCrumbRoute === undefined) {
          breadCrumbRoute = {
            title: classify(name)
          }
        }
        let breadCrumb = copy(breadCrumbRoute);

        if (typeOf(breadCrumb) === 'null') {
          return;
        } else {
          if (isPresent(breadCrumb.path)) {
            path = breadCrumb.path;
          }

          setProperties(breadCrumb, {
            path,
            isHead,
            isTail,
            linkable: breadCrumb.hasOwnProperty('linkable') ? breadCrumb.linkable : crumbLinkable
          });
        }

        breadCrumbs.pushObject(breadCrumb);
      }
    });

    return emberArray(breadCrumbs.filter((breadCrumb) => typeOf(breadCrumb) !== 'undefined'));
  }
});