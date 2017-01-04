// backbone的Events部分的详细注解

var Events = Backbone.Events = {};

  // Regular expression used to split event strings.
  var eventSplitter = /\s+/;

  // Iterates over the standard `event, callback` (as well as the fancy multiple
  // space-separated events `"change blur", callback` and jQuery-style event
  // maps `{event: callback}`).
  // 拆分多事件，这样使得，真正执行的处理函数（如：onApi,offApi,onceMap...），只需处理单个事件的情况。
  var eventsApi = function(iteratee, events, name, callback, opts) {
    var i = 0, names;
    if (name && typeof name === 'object') {// name是javascript对象， name.key 为 事件名， name.value 为回调函数
      // Handle event maps.
      //如果 有事件callback ，并且 opts没有提供context, 那么设置opts.context为改回调函数
      //也就是说name为object，那么callback不再是回调函数，而是context上下文
      if (callback !== void 0 && 'context' in opts && opts.context === void 0) opts.context = callback;
      //从对象事件名中逐个注册事件
      for (names = _.keys(name); i < names.length ; i++) {
        events = eventsApi(iteratee, events, names[i], name[names[i]], opts);
      }
    } else if (name && eventSplitter.test(name)) { //如果name是带空格的字符串
      // Handle space-separated event names by delegating them individually.
      // 通过空格将事件名分开单独进行注册
      for (names = name.split(eventSplitter); i < names.length; i++) {
        events = iteratee(events, names[i], callback, opts);
      }
    } else {
      //如果name 不是 object，也没有带空格，就认为name，就是单纯的事件名
      // Finally, standard events.
      events = iteratee(events, name, callback, opts);
    }
    //返回事件对象
    return events;
  };


  // Bind an event to a `callback` function. Passing `"all"` will bind
  // the callback to all events fired.
  Events.on = function(name, callback, context) {
    //调用内部方法绑定事件 
    return internalOn(this, name, callback, context);
  };

  // Guard the `listening` argument from the public API.
  // 事件监听的公共API，几种监听事件方法都会使用该函数
  // 
  var internalOn = function(obj, name, callback, context, listening) {
    obj._events = eventsApi(onApi, obj._events || {}, name, callback, {
      context: context,
      ctx: obj,
      listening: listening
    });

    if (listening) {
      var listeners = obj._listeners || (obj._listeners = {});
      listeners[listening.id] = listening;
    }

    return obj;
  };

  // Inversion-of-control versions of `on`. Tell *this* object to listen to
  // an event in another object... keeping track of what it's listening to
  // for easier unbinding later.
  // 让 object 监听 另一个（other）对象上的一个特定事件。
  // 不使用other.on(event, callback, object)，而使用这种形式的优点是：
  // listenTo允许 object来跟踪这个特定事件，并且以后可以一次性全部移除它们。
  // callback总是在object上下文环境中被调用。
  // 例如：view.listenTo(model,'change',function(){})
  // 通过上栗的监听事件的注册，只要model的字段发生改变，view就能监听到，并做出相应的回调。
  // 从而实现数据改变同时，view也能跟着改变。
  Events.listenTo = function(obj, name, callback) {
    //obj不存在则直接返回
    if (!obj) return this;
    //ID赋值，obj有_listenId直接使用，没有则新创建个唯一的ID
    var id = obj._listenId || (obj._listenId = _.uniqueId('l'));
    // this._listeningTo存放 所有注册的联动事件对象
    var listeningTo = this._listeningTo || (this._listeningTo = {});
    var listening = listeningTo[id];

    // This object is not listening to any other events on `obj` yet.
    // Setup the necessary references to track the listening callbacks.
    if (!listening) {
      var thisId = this._listenId || (this._listenId = _.uniqueId('l'));
      listening = listeningTo[id] = {obj: obj, objId: id, id: thisId, listeningTo: listeningTo, count: 0};
    }

    // Bind callbacks on obj, and keep track of them on listening.
    internalOn(obj, name, callback, this, listening);
    return this;
  };

  // The reducing API that adds a callback to the `events` object.
  // 
  var onApi = function(events, name, callback, options) {
    // 回调函数存在的情况下才注册
    if (callback) {
      // 取出该事件名下的所有监听者数组（也就是说，可能该事件名已经注册过了，一个事件名可以进行多次的监听）
      // 没有监听者，就返回空数组
      var handlers = events[name] || (events[name] = []);
      var context = options.context, ctx = options.ctx, listening = options.listening;
      if (listening) listening.count++;

      //监听者的元素是一个对象，存放了：
      //回调函数，context（为回调函数的上下文）, ctx （为监听事件的对象），listening 联动监听对象
      handlers.push({callback: callback, context: context, ctx: context || ctx, listening: listening});
    }
    return events;
  };

  // Remove one or many callbacks. If `context` is null, removes all
  // callbacks with that function. If `callback` is null, removes all
  // callbacks for the event. If `name` is null, removes all bound
  // callbacks for all events.
  // 移除一个或多个回调函数，
  // 如果`context` null ，移除所有callback相关的事件，
  // 如果`callback` null, 移除所有事件名相关的事件,
  // 如果`name` null ， 移除该对象上所有注册的事件
  Events.off = function(name, callback, context) {
    if (!this._events) return this;
    this._events = eventsApi(offApi, this._events, name, callback, {
      context: context,
      listeners: this._listeners
    });
    return this;
  };

  // Tell this object to stop listening to either specific events ... or
  // to every object it's currently listening to.
  Events.stopListening = function(obj, name, callback) {
    var listeningTo = this._listeningTo;
    if (!listeningTo) return this;

    var ids = obj ? [obj._listenId] : _.keys(listeningTo);

    for (var i = 0; i < ids.length; i++) {
      var listening = listeningTo[ids[i]];

      // If listening doesn't exist, this object is not currently
      // listening to obj. Break out early.
      if (!listening) break;

      listening.obj.off(name, callback, this);
    }

    return this;
  };

  // The reducing API that removes a callback from the `events` object.
  var offApi = function(events, name, callback, options) {
    if (!events) return;

    var i = 0, listening;
    var context = options.context, listeners = options.listeners;

    // Delete all events listeners and "drop" events.
    if (!name && !callback && !context) {
      var ids = _.keys(listeners);
      for (; i < ids.length; i++) {
        listening = listeners[ids[i]];
        delete listeners[listening.id];
        delete listening.listeningTo[listening.objId];
      }
      return;
    }

    var names = name ? [name] : _.keys(events);
    for (; i < names.length; i++) {
      name = names[i];
      var handlers = events[name];

      // Bail out if there are no events stored.
      if (!handlers) break;

      // Replace events if there are any remaining.  Otherwise, clean up.
      var remaining = [];
      for (var j = 0; j < handlers.length; j++) {
        var handler = handlers[j];
        if (
          callback && callback !== handler.callback &&
            callback !== handler.callback._callback ||
              context && context !== handler.context
        ) {
          remaining.push(handler);
        } else {
          listening = handler.listening;
          if (listening && --listening.count === 0) {
            delete listeners[listening.id];
            delete listening.listeningTo[listening.objId];
          }
        }
      }

      // Update tail event if the list has any events.  Otherwise, clean up.
      if (remaining.length) {
        events[name] = remaining;
      } else {
        delete events[name];
      }
    }
    return events;
  };

  // Bind an event to only be triggered a single time. After the first time
  // the callback is invoked, its listener will be removed. If multiple events
  // are passed in using the space-separated syntax, the handler will fire
  // once for each event, not once for a combination of all events.
  Events.once = function(name, callback, context) {
    // Map the event into a `{event: once}` object.
    // 通过调用该方法 返回events = {event: once}  , event 为传入的name , once 为通过onceMap中的_.once()
    var events = eventsApi(onceMap, {}, name, callback, _.bind(this.off, this));
    // 判断 如果 name 是string类型并且context不存在 ，那么callback 置空。
    // 也就是说，传入的name不是对象，只是事件名，那么后面的参数有两种情况
    // 1. 第二个参数就应该是callback，第三个参数应该为回调函数的作用域，
    // 2. 只有第二个参数，没有第三个参数
    // 如果是第二中情况，callback 就设置为 void 0  (undefined === void 0)
    
    if (typeof name === 'string' && context == null) callback = void 0;
    return this.on(events, callback, context);
  };

  // Inversion-of-control versions of `once`.
  Events.listenToOnce = function(obj, name, callback) {
    // Map the event into a `{event: once}` object.
    var events = eventsApi(onceMap, {}, name, callback, _.bind(this.stopListening, this, obj));
    return this.listenTo(obj, events);
  };

  // Reduces the event callbacks into a map of `{event: onceWrapper}`.
  // `offer` unbinds the `onceWrapper` after it has been called.
  var onceMap = function(map, name, callback, offer) {
    if (callback) {
      var once = map[name] = _.once(function() {
        offer(name, once);
        callback.apply(this, arguments);
      });
      once._callback = callback;
    }
    return map;
  };

  // Trigger one or many events, firing all bound callbacks. Callbacks are
  // passed the same arguments as `trigger` is, apart from the event name
  // (unless you're listening on `"all"`, which will cause your callback to
  // receive the true name of the event as the first argument).
  // 可以触发一个或多个事件，
  // 另外如果监听了`all`事件，那么无论触发的是什么事件，`all`事件都会跟着触发。
  // 触发`all`事件时，会带上触发该事件的事件名,如：a.trigger('change'); 
  // 那么`all`事件的回调函数第一个参数就是'change',等于是告诉`all`谁触发了它。
  Events.trigger = function(name) {
    if (!this._events) return this;

    var length = Math.max(0, arguments.length - 1);
    var args = Array(length);
    for (var i = 0; i < length; i++) args[i] = arguments[i + 1];

    eventsApi(triggerApi, this._events, name, void 0, args);
    return this;
  };

  // Handles triggering the appropriate event callbacks.
  // 这边的callback参数，其实是没用的
  // 每一个事件名调用一次
  var triggerApi = function(objEvents, name, callback, args) {
    if (objEvents) {
      var events = objEvents[name];
      var allEvents = objEvents.all;
      //对`all`事件数组做了浅拷贝
      //为什么这边需要做浅拷贝呢，猜测：
      //例如：obj.listentTo()监听的事件，通过obj._listeningTo可以获得监听对象，
      //      从而获得监听对象下所有的events，如果对events.all进行修改，会影响allEvents的调用
      if (events && allEvents) allEvents = allEvents.slice();
      if (events) triggerEvents(events, args);
      if (allEvents) triggerEvents(allEvents, [name].concat(args));
    }
    return objEvents;
  };

  // A difficult-to-believe, but optimized internal dispatch function for
  // triggering events. Tries to keep the usual cases speedy (most internal
  // Backbone events have 3 arguments).
  // 根据参数数量不同，使用不同的函数调用方式。
  // 目的是对函数调用进行优化，先尝试使用`call`调用，尽量的不去使用`apply`调用
  // https://jsperf.com/call-apply-segu/50 测试`call`,`apply`性能
  var triggerEvents = function(events, args) {
    var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
    switch (args.length) {
      case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
      case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
      case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
      case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
      default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args); return;
    }
  };

  // Aliases for backwards compatibility.
  Events.bind   = Events.on;
  Events.unbind = Events.off;

  // Allow the `Backbone` object to serve as a global event bus, for folks who
  // want global "pubsub" in a convenient place.
  _.extend(Backbone, Events);