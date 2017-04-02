var nest = require('unofficial-nest-api'),
    querystring = require('querystring'),
    http = require('http'),
    username = process.env.NEST_USERNAME,
    password = process.env.NEST_PASSWORD,
    device = process.env.NEST_DEVICE_ID,
    influxHost = process.env.INFLUX_HOST,
    influxPort = process.env.INFLUX_PORT,
    influxDb = process.env.INFLUX_DB,
    influxUser = process.env.INFLUX_USER,
    influxPassword = process.env.INFLUX_PASSWORD,
    tempCelsius = process.env.TEMP_CELSIUS,
    wundergroundData = process.env.WUNDERGROUND_DATA,
    wundergroundKey = process.env.WUNDERGROUND_KEY,
    wundergroundStation = process.env.WUNDERGROUND_STATION

var influxReqOptions = {
        host: influxHost,
        port: influxPort,
        path: '/write?db=' + influxDb + '&' + querystring.stringify({ u: influxUser, p: influxPassword }),
        method: 'POST'
    },
    wundergroundReqOptions = {
        host: 'api.wunderground.com',
        path: '/api/' + wundergroundKey + '/conditions/q/pws:' + wundergroundStation + '.json',
        method: 'GET'
    }

nest.login(username, password, function (err, data) {
    if (err) {
        console.error('There was some weird error')
        console.error(err)
        process.exit(1)
    }

    nest.fetchStatus(function (data) {
        var influxData = []

        if (!data.hasOwnProperty('device') || !data.device.hasOwnProperty(device)) {
            console.error('Could not find device with the id "' + device + '"')
            process.exit(1)
        }

        if (!data.hasOwnProperty('shared') || !data.shared.hasOwnProperty(device)) {
            console.error('Could not find shared device with the id "' + device + '"')
            process.exit(1)
        }

        addInfluxPoint(data.device[device], 'battery_level', null, influxData)
        addInfluxPoint(data.device[device], 'current_humidity', null, influxData)
        addInfluxPoint(data.device[device], 'target_humidity', null, influxData)
        addInfluxPoint(data.device[device], 'learning_days_completed_heat', null, influxData)

        addInfluxPoint(data.shared[device], 'target_temperature', null, influxData, fToC)
        addInfluxPoint(data.shared[device], 'current_temperature', null, influxData, fToC)
        addInfluxPoint(data.shared[device], 'auto_away', 'auto_away_on', influxData)
        addInfluxPoint(data.shared[device], 'hvac_heater_state', 'heater_on', influxData, function (value) {
            if (value) {
                return 1
            }

            return 0
        })

        console.log(JSON.stringify(influxData))
        postInfluxData(influxData, function () {
            console.log('NEST DONE!')

            if(wundergroundData == 'true'){
                wunderground()
            }
        })
    })
})

/**
 * Helper function to get weather information from Weather Underground and insert into Influx
 */
var wunderground = function () {
    http.get(wundergroundReqOptions, function (response) {
        var data = ''
        response.on('data', function (body) {
            data += body.toString()
        })

        response.on('end', function () {
            try {
                var wundergroundData = JSON.parse(data)
            } catch (error) {
                console.error('Failed to parse wunderground data')
                console.error(data)
                process.exit(1)
            }

            if (!wundergroundData.hasOwnProperty('current_observation')) {
                console.error('Did not find the weather info we need!')
                console.error(data)
                process.exit(1)
            }

            var influxData = []
            addInfluxPoint(wundergroundData['current_observation'], 'temp_f', 'outside_temperature', influxData)
            addInfluxPoint(wundergroundData['current_observation'], 'relative_humidity', 'outside_humidity', influxData, parseInt)

            postInfluxData(influxData, function () {
                console.log('WUNDERGROUND DONE!')
                process.exit(0)
            })
        })
    }).on('error', function (error) {
        console.error('Wunderground error')
        console.error(error)
        process.exit(1)
    })
}

/**
 * Handles posting an Influx data structure to Influx
 * If this fails to insert into Influx the program is terminated
 *
 * @param {Object} data The Influx data structure to submit
 * @param {Function} callback A function that is called on success
 */
var postInfluxData = function (data, callback) {
    var resBody = ''

    var req = http.request(influxReqOptions, function (res) {

        res.setEncoding('binary')

        res.on('data', function (data) {
            resBody += data.toString()
        })

        res.on('end', function () {
            if (res.statusCode != '204') {
                console.error('Something bad happened with influx!')
                console.error(resBody)
                process.exit(1)
            }

            callback()
        })
    })

    req.on('error', function (error) {
        console.error('Influx did not like us')
        console.error(error)
        process.exit(1)
    })

    var bindata = ''

    for (var i = 0, len = data.length; i < len; i++) {
        bindata += data[i].name + ",deviceID=" + device + " value=" + data[i].points[0][0]+"\n"
    }

    req.write(bindata, 'binary')
    req.end(null,'binary')
}

/**
 * Add a data point to an Influx data structure for import into Influx
 *
 * @param {Object} source The object to search for the point to add into destination
 * @param {String} point The property in source to add into destination
 * @param {String} [name=point] Overrides the point name in the Influx data structure
 * @param {Object} destination The object to insert the data from source into (this is what will be given to Influx)
 * @param {Function} [convertFunc] Optional function to convert a found point value
 */
var addInfluxPoint = function (source, point, name, destination, convertFunc) {
    if (source.hasOwnProperty(point)) {
        var useName = (name == void 0) ? point : name
            , useFunc = convertFunc || function (value) { return value }
        destination.push({
            name: 'nest.' + useName,
            columns: [ 'value' ],
            points: [[ useFunc(source[point]) ]]
        })
    }
}

/**
 * Convert Celsius to Fahrenheit
 *
 * @param {Number} temp The temperature in Celsius
 *
 * @returns {Number} The temperature in Fahrenheit
 */
var fToC = function (temp) {
    if(tempCelsius == 'true'){
        return temp
    }

    return ((temp * (9 / 5)) + 32)
}
