var myapp = angular.module('appTestComponentsHtml5');

myapp.directive('speechRecognizerProjectOxford', function($http, $timeout, $parse) {
	var directive = {};
	directive.restrict = 'E';
	directive.template = "<button ng-click = 'record()'>{{label}}</button><br/><ng-transclude> </ng-transclude>" + 
						"Your message is <div ng-if='textMessage'>{{textMessage}}</div>";
	directive.scope = {
		label: '@label'
	};
	
	directive.transclude = true;

	directive.link = function(scope, elem, attrs) {
		scope.record = function() {
			console.log("scrollRight  clicked");
			recording = true;
			// reset the buffers for the new recording
			leftchannel.length = rightchannel.length = 0;
			recordingLength = 0;
			// if S is pressed, we stop the recording and package the WAV file
			//promise = $interval(createAudioBufferAndSendIt, 5000);
			$timeout(createAudioBufferAndSendIt, 2000);
		}
		scope.rootElem = elem;

		// variables
		var leftchannel = [];
		var rightchannel = [];
		var recorder = null;
		var recording = false;
		var recordingLength = 0;
		var volume = null;
		var audioInput = null;
		var sampleRate = null;
		var audioContext = null;
		var context = null;
		var outputElement = document.getElementById('output');
		var outputString;
		var audioBuffer = null;
		// feature detection 
		if (!navigator.getUserMedia)
			navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia ||
			navigator.mozGetUserMedia || navigator.msGetUserMedia;
		if (navigator.getUserMedia) {
			navigator.getUserMedia({
				audio: true
			}, success, function(e) {
				alert('Error capturing audio.');
			});
		} else alert('getUserMedia not supported in this browser.');


		function createAudioBufferAndSendIt() {
			// we stop recording
			recording = false;
			// we flat the left and right channels down
			var leftBuffer = mergeBuffers(leftchannel, recordingLength);
			var rightBuffer = mergeBuffers(rightchannel, recordingLength);
			// we interleave both channels together
			var interleaved = interleave(leftBuffer, rightBuffer);
			// we create our wav file
			var buffer = new ArrayBuffer(44 + interleaved.length * 2);
			var view = new DataView(buffer);
			// RIFF chunk descriptor
			writeUTFBytes(view, 0, 'RIFF');
			view.setUint32(4, 44 + interleaved.length * 2, true);
			writeUTFBytes(view, 8, 'WAVE');
			// FMT sub-chunk
			writeUTFBytes(view, 12, 'fmt ');
			view.setUint32(16, 16, true);
			view.setUint16(20, 1, true);
			// stereo (2 channels)
			view.setUint16(22, 2, true);
			view.setUint32(24, sampleRate, true);
			view.setUint32(28, sampleRate * 4, true);
			view.setUint16(32, 4, true);
			view.setUint16(34, 16, true);
			// data sub-chunk
			writeUTFBytes(view, 36, 'data');
			view.setUint32(40, interleaved.length * 2, true);
			// write the PCM samples
			var lng = interleaved.length;
			var index = 44;
			var volume = 1;
			for (var i = 0; i < lng; i++) {
				view.setInt16(index, interleaved[i] * (0x7FFF * volume), true);
				index += 2;
			}
			audioBuffer = new Uint8Array(view.buffer);
			speechToTextEngine();

		}

		function interleave(leftChannel, rightChannel) {
			var length = leftChannel.length + rightChannel.length;
			var result = new Float32Array(length);
			var inputIndex = 0;
			for (var index = 0; index < length;) {
				result[index++] = leftChannel[inputIndex];
				result[index++] = rightChannel[inputIndex];
				inputIndex++;
			}
			return result;
		}

		function mergeBuffers(channelBuffer, recordingLength) {
			var result = new Float32Array(recordingLength);
			var offset = 0;
			var lng = channelBuffer.length;
			for (var i = 0; i < lng; i++) {
				var buffer = channelBuffer[i];
				result.set(buffer, offset);
				offset += buffer.length;
			}
			return result;
		}

		function writeUTFBytes(view, offset, string) {
			var lng = string.length;
			for (var i = 0; i < lng; i++) {
				view.setUint8(offset + i, string.charCodeAt(i));
			}
		}

		function success(e) {
			// creates the audio context
			audioContext = window.AudioContext || window.webkitAudioContext;
			context = new audioContext();
			// we query the context sample rate (varies depending on platforms)
			sampleRate = context.sampleRate;
			console.log('succcess');
			// creates a gain node
			volume = context.createGain();
			// creates an audio node from the microphone incoming stream
			audioInput = context.createMediaStreamSource(e);
			// connect the stream to the gain node
			audioInput.connect(volume);
			/* From the spec: This value controls how frequently the audioprocess event is 
			dispatched and how many sample-frames need to be processed each call. 
			Lower values for buffer size will result in a lower (better) latency. 
			Higher values will be necessary to avoid audio breakup and glitches */
			var bufferSize = 2048;
			recorder = context.createScriptProcessor(bufferSize, 2, 2);
			recorder.onaudioprocess = function(e) {
					if (!recording) return;
					var left = e.inputBuffer.getChannelData(0);
					var right = e.inputBuffer.getChannelData(1);
					// we clone the samples
					leftchannel.push(new Float32Array(left));
					rightchannel.push(new Float32Array(right));
					recordingLength += bufferSize;
					console.log('recording');
				}
				// we connect the recorder
			volume.connect(recorder);
			recorder.connect(context.destination);
		}
		var clientId = 'test-app'; // Can be anything
		var clientSecret = '919963ddb0f143009e81cc1c00046483'; // API key from Azure marketplace
		// ==== Helpers ====
		function getAccessToken(clientId, clientSecret, callback) {
			var req = {
				method: 'POST',
				url: 'https://oxford-speech.cloudapp.net/token/issueToken',
				data: {
					'grant_type': 'client_credentials',
					'client_id': encodeURIComponent(clientId),
					'client_secret': encodeURIComponent(clientSecret),
					'scope': 'https://speech.platform.bing.com'
				}
			};
			$http(req).then(function(response) {
				if (response.status != 200) return callback(response);
				var accessToken = response.data.access_token;
				if (accessToken) {
					callback(null, accessToken);
				} else {
					callback(response);
				}
			});
		}

		function speechToText(accessToken, callback) {
			var fd = new FormData()
			fd.append('audio', scope.content);
			var req = {
				method: 'POST',
				url: 'https://speech.platform.bing.com/recognize/query',
				params: {
					'scenarios': 'ulm',
					'appid': 'D4D52672-91D7-4C74-8AD8-42B1D98141A5', // This magic value is required
					'locale': 'en-US',
					'device.os': 'wp7',
					'version': '3.0',
					'format': 'json',
					'requestid': '1d4b6030-9099-11e0-91e4-0800200c9a66', // can be anything
					'instanceid': '1d4b6030-9099-11e0-91e4-0800200c9a66' // can be anything
				},
				data: audioBuffer,
				headers: {
					'Authorization': 'Bearer ' + accessToken,
					'Content-Type': 'audio/wav; samplerate=16000',
					'Content-Length': audioBuffer.length
				},
				transformRequest: angular.identity
			};
			$http(req).then(function(resp) {
				if (resp.status != 200) {
					return callback(resp);
				}
				callback(null, resp.data);
			});
		}
		
		function checkIfValidMessage(commands, message){
			for (var i = 0; i < commands.length; i++) {
				if(commands[i].getAttribute('text') == message){
					eval('angular.element(commands[i]).scope().$$childHead.' + commands[i].getAttribute('on-recognize'));
					break;
				}
			}
			if(i == commands.length){
				console.log("Command not recognized");
			}
		}

		function speechToTextEngine() {
			getAccessToken(clientId, clientSecret, function(response, accessToken) {
				if (response) {
					console.log("Something is not ok in our response");
				}
				console.log('Got access token: ' + accessToken)
				speechToText(accessToken, function(err, res) {
					if (err) {
						console.log("We have an error");
						return console.log(err);
					}
					

					if (res == null || res == undefined || res.results == null ) {
						console.log("Something is not ok in our response");
						return;
					}
					scope.textMessage = res.results[0].lexical;
					
					var rootElemChildren = scope.rootElem.children();
					if (rootElemChildren == null || rootElemChildren[2] == null || rootElemChildren[2].children == null) {
						console.log("No children commands detected");
						return;
					}
					
					var transcludeNodeChildren = rootElemChildren[2].children;
					
					checkIfValidMessage(transcludeNodeChildren, scope.textMessage); 

					
					

				});
			})
		}
	}

	

	return directive;
})