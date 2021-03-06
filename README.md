JAMS: Just A Modular System
====

Although I have not extensively used Pure Data nor Max MSP, I know of their existence as well as how they briefly work. This is an attempt to build a similar application in Javascript. Below is the acknowledgments, I hope you'll contribute!

## Issues & Acknowledgments

Because I'm not an expert in Javascript, I really hope someone could take up this project and progress further. Here are some things I think can be improved:

* The current behavior when a user drags/clicks on a module is that the app will move the module on the workspace. Some modules (Number) are interactive when the user holds Shift key and drags it. I personally think this is an icky behavior and modules should be interactive without holding Shift. If this behavior is adapted, the module should tell the main app if it's blocking or not, so the app can decide to drag the module's position or not.

* ScriptNodeProcessor is now [deprecated](https://webaudio.github.io/web-audio-api/#the-scriptprocessornode-interface---deprecated). Adapt to the new AudioWorklet when it is rolled out.

* Make this application available offline using [Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API).

* Users will be able to store the setups without saving files (currently as JSON). Something like indexedDB, perhaps?

* There have been discussions with [@stai12](https://github.com/stai12) about whether `JAMS` and its Modules should handle graphical interface or not. Currently it is, par argument that saving/loading setups will be easier. I think having it only handling audio is very appealing, especially if somebody wants to include it in their project without using the UI (you can already route it in your own AudioContext).

* This entire project should be rewritten in compliance with the ES6 syntaxes, which I know nothing about. On top of that, many parts of it (including `Interface.render()` and `JAMS.render()`) should be re-structured.

* Standardize on how triggers should be handled. Current we assess if the current sample is 1 over the last sample (dx/dt >= 1 with t in samples). The `JAMSOnOffEnvelope` current detects triggers using this way. `SimpleDecay` is still detecting if the current sample is exactly 1.

* Modules shouldn't stay in one file. They should be in many files for the sake of organization, but then I don't want the clients to make multiple requests to my server. Some sort of compiling script should be make to mesh all these files up together. Same for Interface modules.

* Can the interface be rendered using WebGL or something? I thought it might be slower using Canvas2DRenderingContext.

## Usage

You can go to [this file](lib/jams.plugins.js) and read the self-documenting plug-ins.

## FAQ

### How Do I create a Square Wave?

Use `t` (inverted), `Multiplier` (for frequency), `Remainders%1` (to make a ramp down), split with one going to `Plus+` (for offset pulse-width). Hook these two up with `OnOffEnvelope`. 

## License

I'll think about this later. 