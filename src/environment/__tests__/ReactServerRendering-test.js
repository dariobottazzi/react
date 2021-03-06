/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @jsx React.DOM
 * @emails react-core
 */

/*jslint evil: true */

"use strict";

require('mock-modules')
  .dontMock('ExecutionEnvironment')
  .dontMock('React')
  .dontMock('ReactID')
  .dontMock('ReactServerRendering')
  .dontMock('ReactTestUtils');

var React;
var ReactID;
var ReactTestUtils;
var ReactServerRendering;
var ExecutionEnvironment;

describe('ReactServerRendering', function() {
  beforeEach(function() {
    require('mock-modules').dumpCache();
    React = require('React');
    ReactID = require('ReactID');
    ReactTestUtils = require('ReactTestUtils');
    ExecutionEnvironment = require('ExecutionEnvironment');
    ExecutionEnvironment.canUseDOM = false;
    ReactServerRendering = require('ReactServerRendering');
  });

  it('should generate simple markup', function() {
    var response;
    ReactServerRendering.renderComponentToString(
      <span>hello world</span>,
      function(response_) {
        response = response_;
      }
    );
    expect(response).toMatch(
      '<span  ' + ReactID.ATTR_NAME + '="[^"]+">hello world</span>'
    );
  });

  it('should render composite components', function() {
    var Parent = React.createClass({
      render: function() {
        return <div><Child name="child" /></div>;
      }
    });
    var Child = React.createClass({
      render: function() {
        return <span>My name is {this.props.name}</span>;
      }
    });
    var response;
    ReactServerRendering.renderComponentToString(
      <Parent />,
      function(response_) {
        response = response_;
      }
    );
    expect(response).toMatch(
      '<div  ' + ReactID.ATTR_NAME + '="[^"]+">' +
        '<span  ' + ReactID.ATTR_NAME + '="[^"]+">' +
          '<span ' + ReactID.ATTR_NAME + '="[^"]+">My name is </span>' +
          '<span ' + ReactID.ATTR_NAME + '="[^"]+">child</span>' +
        '</span>' +
      '</div>'
    );
  });

  it('should only execute certain lifecycle methods', function() {
    var lifecycle = [];
    var TestComponent = React.createClass({
      componentWillMount: function() {
        lifecycle.push('componentWillMount');
      },
      componentDidMount: function() {
        lifecycle.push('componentDidMount');
      },
      getInitialState: function() {
        lifecycle.push('getInitialState');
        return {name: 'TestComponent'};
      },
      render: function() {
        lifecycle.push('render');
        return <span>Component name: {this.state.name}</span>;
      },
      componentWillUpdate: function() {
        lifecycle.push('componentWillUpdate');
      },
      componentDidUpdate: function() {
        lifecycle.push('componentDidUpdate');
      },
      shouldComponentUpdate: function() {
        lifecycle.push('shouldComponentUpdate');
      },
      componentWillReceiveProps: function() {
        lifecycle.push('componentWillReceiveProps');
      },
      componentWillUnmount: function() {
        lifecycle.push('componentWillUnmount');
      }
    });

    var response;

    ReactServerRendering.renderComponentToString(
      <TestComponent />,
      function (_response) {
        response = _response;
      }
    );

    expect(response).toMatch(
      '<span  ' + ReactID.ATTR_NAME + '="[^"]+">' +
        '<span ' + ReactID.ATTR_NAME + '="[^"]+">Component name: </span>' +
        '<span ' + ReactID.ATTR_NAME + '="[^"]+">TestComponent</span>' +
      '</span>'
    );
    expect(lifecycle).toEqual(
      ['getInitialState', 'componentWillMount', 'render']
    );
  });

  it('should have the correct mounting behavior', function() {
    // This test is testing client-side behavior.
    ExecutionEnvironment.canUseDOM = true;

    var mountCount = 0;
    var numClicks = 0;

    var TestComponent = React.createClass({
      componentWillMount: function() {
        mountCount++;
      },
      click: function() {
        numClicks++;
      },
      render: function() {
        return (
          <span ref="span" onClick={this.click}>Name: {this.props.name}</span>
        );
      }
    });

    var element = document.createElement('div');
    React.renderComponent(<TestComponent />, element);

    var lastMarkup = element.innerHTML;

    // Exercise the update path. Markup should not change,
    // but some lifecycle methods should be run again.
    React.renderComponent(<TestComponent name="x" />, element);
    expect(mountCount).toEqual(1);

    // Unmount and remount. We should get another mount event and
    // we should get different markup, as the IDs are unique each time.
    React.unmountAndReleaseReactRootNode(element);
    expect(element.innerHTML).toEqual('');
    React.renderComponent(<TestComponent name="x" />, element);
    expect(mountCount).toEqual(2);
    expect(element.innerHTML).not.toEqual(lastMarkup);

    // Now kill the node and render it on top of the old markup, as if
    // we used server rendering. We should mount again, but the markup should be
    // unchanged.
    lastMarkup = element.innerHTML;
    React.unmountAndReleaseReactRootNode(element);
    expect(element.innerHTML).toEqual('');
    element.innerHTML = lastMarkup;
    // NOTE: we pass a different name here. This is to ensure that the markup
    // being generated is not replaced.
    var instance = React.renderComponent(<TestComponent name="y" />, element);
    expect(mountCount).toEqual(3);
    expect(element.innerHTML).toEqual(lastMarkup);

    // Ensure the events system works
    expect(numClicks).toEqual(0);
    ReactTestUtils.Simulate.click(instance.refs.span.getDOMNode());
    expect(numClicks).toEqual(1);
  });
});
