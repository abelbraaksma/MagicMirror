/* Magic Mirror
 * Module: Compliments
 *
 * By Michael Teeuw https://michaelteeuw.nl
 * MIT Licensed.
 */
Module.register("compliments", {
	// Module config defaults.
	defaults: {
		compliments: {
			anytime: ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"]
			//morning: ["Good morning, handsome!", "Enjoy your day!", "How was your sleep?"],
			//afternoon: ["Hello, beauty!", "You look sexy!", "Looking good today!"],
			//evening: ["Wow, you look hot!", "You look nice!", "Hi, sexy!"],
			//"....-01-01": ["Happy new year!"]
		},
		updateInterval: 60000 * 60,
		remoteFile: null,
		fadeSpeed: 1000,
		morningStartTime: 3,
		morningEndTime: 12,
		afternoonStartTime: 12,
		afternoonEndTime: 17,
		random: false,
		mockDate: null
	},
	maxQuotesPerDay: 5,
	lastIndexUsed: -1,
	// Set currentweather from module
	currentWeatherType: "",

	// Define required scripts.
	getScripts: function () {
		return ["moment.js"];
	},

	// Define start sequence.
	start: function () {
		Log.info("Starting module: " + this.name);

		this.lastComplimentIndex = -1;

		var self = this;
		if (this.config.remoteFile !== null) {
			this.complimentFile(function (response) {
				self.config.compliments = JSON.parse(response);
				self.updateDom();
			});
		}

		/// Current time in ms
		var currentTime = Number(new Date().getTime());
		var shiftMsForPerMinute = currentTime % 60000;
		var shiftMsForPerHour = currentTime % 3600000;
		var shiftMsForPerDay = Math.round(currentTime % (3600000 * 24));

		var firstInterval = 0;

		if (Math.round(this.config.updateInterval / 1000) == 60) {
			firstInterval = this.config.updateInterval - shiftMsForPerMinute;
			Log.info("Found an 'updateInterval' that is exactly 1 minute");
			Log.info("First interval will last: " + firstInterval / 1000 + "sec");
			Log.info("Shift is " + shiftMsForPerMinute / 1000 + "sec");
		}

		if (Math.round(this.config.updateInterval / 1000) == 3600) {
			firstInterval = this.config.updateInterval - shiftMsForPerHour;
			Log.info("Found an 'updateInterval' that is exactly 1 hour long");
			Log.info("First interval will last: " + Math.floor(firstInterval / 60000) + "min");
			Log.info("Shift is approx. " + Math.floor(shiftMsForPerHour / 60000) + "min");
		}

		if (Math.round(this.config.updateInterval / 1000) == 3600 * 24) {
			firstInterval = this.config.updateInterval - shiftMsForPerDay;
			Log.info("Found an 'updateInterval' that is exactly 1 day long");
			Log.info("First interval will last: " + Math.floor(firstInterval / 3600000) + "hr and " + (Math.floor(firstInterval / 60000) % 60) + "min");
			Log.info("Shift is approx. " + Math.floor(shiftMsForPerDay / 3600000) + "hr and " + (Math.floor(shiftMsForPerDay / 60000) % 60) + "min");
		}

		if (firstInterval == 0) {
			Log.info("No 'updateInterval' found that is either 1 minute, 1 hour or 1 day long");
			setInterval(function () {
				self.updateDom(self.config.fadeSpeed);
			}, self.config.updateInterval);
		} else {
			// set a timeout that shifts to the whole minute, hour or day, so that the interval can start later
			setTimeout(function () {
				// Schedule subsequent update timers.
				self.updateDom(self.config.fadeSpeed);
				setInterval(function () {
					self.updateDom(self.config.fadeSpeed);
				}, self.config.updateInterval);
			}, firstInterval);
		}
	},

	/* randomIndex(compliments)
	 * Generate a random index for a list of compliments.
	 *
	 * argument compliments Array<String> - Array with compliments.
	 *
	 * return Number - Random index.
	 */
	randomIndex: function (compliments) {
		if (compliments.length === 1) {
			return 0;
		}

		var generate = function () {
			return Math.floor(Math.random() * compliments.length);
		};

		var complimentIndex = generate();

		while (complimentIndex === this.lastComplimentIndex) {
			complimentIndex = generate();
		}

		this.lastComplimentIndex = complimentIndex;

		return complimentIndex;
	},

	/* complimentArray()
	 * Retrieve an array of compliments for the time of the day.
	 *
	 * return compliments Array<String> - Array with compliments for the time of the day.
	 */
	complimentArray: function () {
		var hour = moment().hour();
		var date = this.config.mockDate ? this.config.mockDate : moment().format("YYYY-MM-DD");
		var compliments;

		if (hour >= this.config.morningStartTime && hour < this.config.morningEndTime && this.config.compliments.hasOwnProperty("morning")) {
			compliments = this.config.compliments.morning.slice(0);
		} else if (hour >= this.config.afternoonStartTime && hour < this.config.afternoonEndTime && this.config.compliments.hasOwnProperty("afternoon")) {
			compliments = this.config.compliments.afternoon.slice(0);
		} else if (this.config.compliments.hasOwnProperty("evening")) {
			compliments = this.config.compliments.evening.slice(0);
		}

		if (typeof compliments === "undefined") {
			compliments = new Array();
		}

		if (this.currentWeatherType in this.config.compliments) {
			compliments.push.apply(compliments, this.config.compliments[this.currentWeatherType]);
		}

		compliments.push.apply(compliments, this.config.compliments.anytime);

		for (var entry in this.config.compliments) {
			if (new RegExp(entry).test(date)) {
				compliments.push.apply(compliments, this.config.compliments[entry]);
			}
		}

		return compliments;
	},

	/* complimentFile(callback)
	 * Retrieve a file from the local filesystem
	 */
	complimentFile: function (callback) {
		var xobj = new XMLHttpRequest(),
			isRemote = this.config.remoteFile.indexOf("http://") === 0 || this.config.remoteFile.indexOf("https://") === 0,
			path = isRemote ? this.config.remoteFile : this.file(this.config.remoteFile);
		xobj.overrideMimeType("application/json");
		xobj.open("GET", path, true);
		xobj.onreadystatechange = function () {
			if (xobj.readyState === 4 && xobj.status === 200) {
				callback(xobj.responseText);
			}
		};
		xobj.send(null);
	},

	/* complimentArray()
	 * Retrieve a random compliment.
	 *
	 * return compliment string - A compliment.
	 */
	randomCompliment: function () {
		// get the current time of day compliments list
		var compliments = this.complimentArray();
		// variable for index to next message to display
		let index = 0;

		// get current day
		var now = new Date();
		var start = new Date(now.getFullYear(), 0, 0);
		var diff = now - start + (start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000;
		var today = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
		var factor = Math.floor(compliments.length / this.maxQuotesPerDay);
		var startIndex = (today % factor) * this.maxQuotesPerDay;

		if (this.lastIndexUsed == -1) {
			// start where we ended after a restart
			this.lastIndexUsed = this.getCookie("lastQuoteIndex") != null ? parseInt(this.getCookie("lastQuoteIndex")) - 1 : -1;
		}

		// are we randomizing
		if (this.config.random) {
			// yes
			index = this.randomIndex(compliments);
		} else {
			// no, sequential
			// if doing sequential, don't fall off the end
			if (this.lastIndexUsed >= this.maxQuotesPerDay - 1) {
				index = 0;
				this.lastIndexUsed = 0;
			} else {
				index = ++this.lastIndexUsed;
			}
			// remember position in case of restart
			this.setCookie("lastQuoteIndex", this.lastIndexUsed.toString(), 365);
		}

		return compliments[index + startIndex] || "";
	},

	// Override dom generator.
	getDom: function () {
		var wrapper = document.createElement("div");
		wrapper.className = this.config.classes ? this.config.classes : "thin xlarge bright pre-line";
		// get the compliment text
		var complimentText = this.randomCompliment();
		// split it into parts on newline text
		var parts = complimentText.split("\n");
		// create a span to hold it all
		var compliment = document.createElement("span");
		// process all the parts of the compliment text
		for (var part of parts) {
			// create a text element for each part
			compliment.appendChild(document.createTextNode(part));
			// add a break `
			compliment.appendChild(document.createElement("BR"));
		}
		// remove the last break
		compliment.lastElementChild.remove();
		wrapper.appendChild(compliment);

		return wrapper;
	},

	// From data currentweather set weather type
	setCurrentWeatherType: function (data) {
		var weatherIconTable = {
			"01d": "day_sunny",
			"02d": "day_cloudy",
			"03d": "cloudy",
			"04d": "cloudy_windy",
			"09d": "showers",
			"10d": "rain",
			"11d": "thunderstorm",
			"13d": "snow",
			"50d": "fog",
			"01n": "night_clear",
			"02n": "night_cloudy",
			"03n": "night_cloudy",
			"04n": "night_cloudy",
			"09n": "night_showers",
			"10n": "night_rain",
			"11n": "night_thunderstorm",
			"13n": "night_snow",
			"50n": "night_alt_cloudy_windy"
		};
		this.currentWeatherType = weatherIconTable[data.weather[0].icon];
	},

	// Override notification handler.
	notificationReceived: function (notification, payload, sender) {
		if (notification === "CURRENTWEATHER_DATA") {
			this.setCurrentWeatherType(payload.data);
		}
	},

	setCookie: function (name, value, days) {
		var expires = "";
		if (days) {
			var date = new Date();
			date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
			expires = "; expires=" + date.toUTCString();
		}
		document.cookie = name + "=" + (value || "") + expires + "; path=/";
	},

	getCookie: function (name) {
		var nameEQ = name + "=";
		var ca = document.cookie.split(";");
		for (var i = 0; i < ca.length; i++) {
			var c = ca[i];
			while (c.charAt(0) == " ") c = c.substring(1, c.length);
			if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
		}
		return null;
	},

	eraseCookie: function (name) {
		document.cookie = name + "=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
	}
});
