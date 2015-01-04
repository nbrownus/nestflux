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
    wundergroundKey = process.env.WUNDERGROUND_KEY,
    wundergroundStation = process.env.WUNDERGROUND_STATION

var influxReqOptions = {
        host: influxHost,
        port: influxPort,
        path: '/db/' + influxDb + '/series?' + querystring.stringify({ u: influxUser, p: influxPassword }),
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
            wunderground()
        })
    })
})

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
            addInfluxPoint(wundergroundData['current_observation'], 'relative_humidity', 'outside_humidity', influxData)

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

var postInfluxData = function (data, callback) {
    var resBody = ''

    var req = http.request(influxReqOptions, function (res) {
        res.on('data', function (data) {
            resBody += data.toString()
        })

        res.on('end', function () {
            if (res.statusCode != '200') {
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

    req.write(JSON.stringify(data))
    req.end()
}

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

var fToC = function (temp) {
    return (((temp * 9) / 5) + 32)
}

/*
"device": {
    "02AA01AC34140FTS": {
        "battery_level": 3.72,
        "current_humidity": 47,

        "away_temperature_high": 24.444,
        "temperature_lock_high_temp": 22.222,
        "leaf_threshold_heat": 18.334,
        "target_humidity": 35,
        "lower_safety_temp": 4.444,
        "current_schedule_mode": "HEAT",
        "leaf_away_high": 28.88,

        "learning_days_completed_heat": 45,

        "away_temperature_low": 12.898,
        "upper_safety_temp": 35,
        "temperature_lock_low_temp": 20,
        "leaf_away_low": 19.444,
    }
},

"shared": {
    "02AA01AC34140FTS": {
        "auto_away": 0,
        "hvac_heater_state": false,
        "target_temperature_high": 24,
        "target_temperature_low": 20,
        "target_temperature": 19.44444,
        "current_temperature": 19.96,
    }
},
 */