'use strict';

var JAMS = function(config) {
	if( !(this instanceof JAMS) ) return new JAMS();

	this.display = new Render({width: config.width, height: config.height});
	this.interface = new Interface(this.display);

	// stuff
	this.ioDisplayHeight = 20;
	this.ioDisplayWidth  = 10;

	this.moduleCounter = 0;
	this.modules = [];

	// interactivity
	this.currentModule = undefined;
	this.currentOutput = undefined;
	this.currentInput  = undefined;

	// Current mouse positions
	this.cmx = 0;
	this.cmy = 0;
	// Workspace translation
	this.cx = 0;
	this.cy = 0;

	// Audio
	this.aC = (config.audioContext instanceof AudioContext)? config.audioContext : new AudioContext();
	this.processor = this.aC.createScriptProcessor(2048, 0, 1);
	this.t = 0;

	this.currentModule = this.outputModule = this.createModule(innerWidth-100, 100, JAMSOutput);
}

JAMS.prototype.appendTo = function(element) {
	this.display.appendTo(element);
	return this;
}

JAMS.prototype.init = function() {
	var _ = this;

	// Audio stuff
	this.processor.connect(_.aC.destination);
	this.processor.onaudioprocess = function(audioProcessingEvent) {
		var obuffer = audioProcessingEvent.outputBuffer;
		var incr = obuffer.length/_.aC.sampleRate;
		for( var ch=0; ch < obuffer.numberOfChannels; ch++ ){
			var odata = obuffer.getChannelData(ch);
			for(var i=0; i<obuffer.length; i++) {
				odata[i] = _.audioLoop(_.t + (i/_.aC.sampleRate) );
			}
		}
		_.t += incr;
	}

	// make DOM focus-able
	this.display.DOMElement.tabIndex = 1; // oh gosh

	// constantly updating mouse position
	_.display.DOMElement.addEventListener("mousemove", e => {
		_.cmx = e.clientX;
		_.cmy = e.clientY;
		_.interface.handleMove(_.cmx, _.cmy);
	});

	// mousedown on app
	this.display.DOMElement.addEventListener("mousedown", e => {

		// Let the interface handles clicks
		var isInterfaceBlocking = _.interface.handleClick(e.clientX, e.clientY, _.display.DOMElement);
		if(isInterfaceBlocking) return;
		// m is for mouse (NOT module!)
		let mx = e.clientX - _.cx;
		let my = e.clientY - _.cy;

		// walks through all modules and see if the mouse is on it or not
		var mouseOnMod = _.modules.some( module => {
			if( mx > module.x - _.ioDisplayWidth && mx < module.x + module.width + _.ioDisplayWidth && my > module.y && my < module.y+module.height ) {
				_.currentModule = module;

				// when it's over a module's output
				if( mx > module.x + module.width && my < module.y + module.numberOfOutputs*_.ioDisplayHeight ) {
					_.currentOutput = Math.floor( (my - module.y)/ _.ioDisplayHeight );
					return true;
				}

				// Shift Drag Event
				if(e.shiftKey == true) {
					_.display.DOMElement.addEventListener("mousemove", mouseShiftDragModuleHandler);
					return true;
				}

				// Normal Drag Event
				_.display.DOMElement.addEventListener("mousemove", mouseDragModuleHandler);
				return true;
			}	
		});

		if(!mouseOnMod) _.display.DOMElement.addEventListener("mousemove", mouseDragCanvasHandler);
	});

	// mouseup on app -- remove listeners -- connect 
	this.display.DOMElement.addEventListener("mouseup", e => {
		// m is for mouse (NOT module!) also, actually, it's anchored to the desktop panning.
		let mx = e.clientX - _.cx; 
		let my = e.clientY - _.cy;

		// walk though each module and connect if it's on some input or whatever
		_.modules.some( module => {
			if( mx > module.x - _.ioDisplayWidth && mx < module.x + _.ioDisplayWidth && 
				my > module.y && my < module.y + module.numberOfInputs*_.ioDisplayHeight ) 
			{
				
				_.currentInput = Math.floor( (my - module.y)/ _.ioDisplayHeight );
				if( _.currentOutput !== undefined ) {
				 	if( module.inputs[_.currentInput] !== undefined && module.inputs[_.currentInput].index == _.currentOutput ) {
				 		module.unsetInput(_.currentInput );
				 	} 
					_.currentModule.connect(module, _.currentInput, _.currentOutput);
				}
				return true;
			}
		})

		_.currentInput  = undefined;
		_.currentOutput = undefined;

		// remove listeners for drag events
		_.display.DOMElement.removeEventListener("mousemove", mouseShiftDragModuleHandler);
		_.display.DOMElement.removeEventListener("mousemove", mouseDragModuleHandler);
		_.display.DOMElement.removeEventListener("mousemove", mouseDragCanvasHandler);
	});

	// rightclick
	this.display.DOMElement.addEventListener("contextmenu", e => {
		e.preventDefault();
		let mx = e.clientX - _.cx;
		let my = e.clientY - _.cy;

		var mouseOnMod = _.modules.some( module => {
			if( mx > module.x - _.ioDisplayWidth && mx < module.x + module.width + _.ioDisplayWidth && my > module.y && my < module.y+module.height ) {
				_.currentModule = module;

				
				// when it's over a module's input
				if( mx < module.x && my < module.y + module.numberOfInputs*_.ioDisplayHeight ) {
					var inputIndex = Math.floor( (my - module.y)/ _.ioDisplayHeight );
					let options = [
						{ 
							text: "Disconnect", 
							callback: function(x, y) {
								module.unsetInput(inputIndex);
							}
						}
					]
					_.interface.createContextMenu(e.clientX, e.clientY, {padding:4}, options);
					return true;
				}

				let options = [
					{
						text: "Delete module",
						callback: function(x,y) {
							_.deleteModule(module);
						}
					},
					{
						text: "Parameters",
						callback: function(x,y) {
							let c = [Interface.TextNode({content:"No parameters\nfor this module", width:1, height: 1})];
							if(module.params.length > 0) {
								c = [];
								module.params.forEach( (param,index,arr) => { 
									c.push(Interface.TextNode({ content: param.name, width: 0.5, height: 1/arr.length }));
									if(param.type == "number") 
										c.push(Interface.NumberNode({
											width: 0.5, height: 1/arr.length,
											getValue: () => param.value,
											setValue: x => {param.value = x;}
										}))
								})
							}
							_.interface.createWindow({
								title: module.name + "'s Parameters",
								width: 200, height: 100,
								x:x, y:y,
								children: c
							});
						}
					}
				]
				if( module !== _.outputModule) _.interface.createContextMenu(e.clientX, e.clientY, {padding:4}, options);
				return true;
			}	
		});

		if(!mouseOnMod) rightClickOnBackground(e);

	})

	// move currently selected module
	this.display.DOMElement.addEventListener("keydown", e => {
		var accl = ~~e.shiftKey << 2;
		switch(e.key.toLowerCase()) {
			case 'a':
				_.currentModule.x -= 1 + accl;
				return;
			case 'd':
				_.currentModule.x += 1 + accl;
				return;
			case 'w':
				_.currentModule.y -= 1 + accl;
				return;
			case 's':
				_.currentModule.y += 1 + accl;
				return;
		}
	}, true);

	// right click on Background
	function rightClickOnBackground(e) {
		var plugins = ["JAMSNumber", "JAMSSineGenerator", "JAMSMultiplier","JAMSt", "JAMSRemainder", "JAMS4Array"]
		var options = plugins.map( plugin => { return {text: plugin, callback: function(x,y) { app.createModule(x-_.cx, y-_.cy, window[plugin])}} });
		_.interface.createContextMenu(e.clientX, e.clientY, {padding: 4} , options);
	}

	// module drag
	function mouseDragModuleHandler(e) { 
		_.currentModule.x += e.movementX;
		_.currentModule.y += e.movementY;
	}
	//canvas drag
	function mouseDragCanvasHandler(e) {
		_.cx += e.movementX;
		_.cy += e.movementY;
	}

	// shiftDrag means throw the event to module's drag handler
	function mouseShiftDragModuleHandler(e) { 
		_.currentModule.handleDrag(e);
	}

	// fire rendering loop
	(function loop() {
		requestAnimationFrame(loop);
		_.renderLoop();
		_.interface.render(_.cmx, _.cmy);
	})();
}

JAMS.prototype.audioLoop = function(t) {
	this.modules.forEach( module => {
		if(module.prerun == true) module.run(t);
	});

	return this.outputModule.run(t);
}

JAMS.prototype.renderLoop = function(w) {
	let _ = this;
	_.display.context.save();
	_.display.background("#15131a");
	_.display.context.translate(_.cx, _.cy);

	// we'll need this for offset. 
	// height is never negative (and we're in an integer environment), so it is reasonably safe to do a bit shift division. 
	let ioDisplayHalfHeight = _.ioDisplayHeight >> 1;

	_.display.context.fillStyle = "white";

	// render the user's probable connection
	if( _.currentOutput !== undefined ) {
		let cmod = _.currentModule;
		_.display.line(
			cmod.x + cmod.width + _.ioDisplayWidth, 
			cmod.y + ioDisplayHalfHeight + _.currentOutput * _.ioDisplayHeight,
			_.cmx - _.cx,
			_.cmy - _.cy);
	}

	// render the modules
	this.modules.forEach( module => {
		// draw module box 
		_.display.context.fillStyle = _.display.context.strokeStyle = `hsl(${module.color}, 100%, ${ (module==_.currentModule)? 50:85 }%)`;
		_.display.box(module.x, module.y, module.width, module.height);

		// inputs
			for(let i=0; i<module.numberOfInputs ; i++) 
				_.display.box(module.x - _.ioDisplayWidth, module.y + i*_.ioDisplayHeight, _.ioDisplayWidth, _.ioDisplayHeight);
		// output
			for(let i=0; i<module.numberOfOutputs; i++) 
				_.display.box(module.x + module.width, module.y+i*_.ioDisplayHeight, _.ioDisplayWidth, _.ioDisplayHeight);
		
		// connections
			for(let i=0; i<module.inputs.length; i++) { 
				//skip unplugged inputs
				if(module.inputs[i] == undefined) continue;

				let sourceModule = module.inputs[i].module;
				_.display.line(
					module.x - _.ioDisplayWidth,
					module.y + ioDisplayHalfHeight + _.ioDisplayHeight*i,
					sourceModule.x + sourceModule.width + _.ioDisplayWidth,
					sourceModule.y + ioDisplayHalfHeight + _.ioDisplayHeight*module.inputs[i].index);
			}

		// call module interface
		_.display.context.save();
		_.display.context.translate(module.x, module.y);
			module.interface(_.display, { ioWidth: _.ioDisplayWidth, ioHeight: _.ioDisplayHeight } );
		_.display.context.restore();

	});
	_.display.context.restore();
}

JAMS.prototype.createModule = function(x, y, module) { 
	var mod = new module({
		id: this.moduleCounter,
		x: x,
		y: y
	});
	
	this.modules.push(mod);
	this.moduleCounter++;
	return mod;
}

JAMS.prototype.deleteModule = function(deletingModule) {
	var i = 0;
	this.modules.forEach( (module,id) => {
		if( module == deletingModule ) i = id;
		module.inputs.forEach( (input,index) => {
			if( !input ) return;
			if( input.module == deletingModule ) module.unsetInput(index);
		});
	});
	this.modules.splice(i, 1);
}

JAMS.prototype.getModuleFromId = function(id) {
	var mod; this.modules.some( m => (mod = m).id == id );
	return mod;
}

JAMS.prototype.saveSetup = function() {
	var setup = [];
	this.modules.forEach( module => {
		var inputsArr = [];
		module.inputs.forEach( (input,ind) => {
			inputsArr[ind] = {
				id : input.id,
				index : input.index
			}
		});

		setup.push({
			id: module.id,
			type: module.className,
			x: module.x,
			y: module.y,
			inputs: inputsArr,
			params: module.params
		})
	});
	return JSON.stringify(setup);
}

JAMS.prototype.loadSetup = function(json) {
	var _ = this;
	try { var setup = JSON.parse(json); }
	catch(e) { console.error("Invalid JSON.", e); return;}

	this.modules = [];
	this.moduleCounter = 0;
	try {
		setup.forEach( module => {
			var mod = app.createModule(module.x, module.y, window[module.type]);
			module.params.forEach( (val, ind) => {
					mod.setParam(ind, val);
			});
			if(module.type == "JAMSOutput") _.outputModule = mod;
		})
		setup.forEach( module => { 
			var targetModule = _.getModuleFromId(module.id);
			module.inputs.forEach( (input,index) => { 
				if( input == null ) return;
				var sourceModule = _.getModuleFromId(input.id); 
				sourceModule.connect(targetModule, index, input.index);
			})
		});
	} catch(e) {
		console.error("Corrupted Setup File: ", e); return;	
	}
}