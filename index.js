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
    influxPassword = process.env.INFLUX_PASSWORD

var reqOptions = {
    host: influxHost,
    port: influxPort,
    path: '/db/' + influxDb + '/series?' + querystring.stringify({ u: influxUser, p: influxPassword }),
    method: 'POST'
}

nest.login(username, password, function (err, data) {
    if (err) {
        console.log('There was some weird error')
        console.log(err)
        process.exit(1)
    }

    nest.fetchStatus(function (data) {
        var influxData = []

        if (!data.hasOwnProperty('device') || !data.device.hasOwnProperty(device)) {
            console.log('Could not find device with the id "' + device + '"')
            process.exit(1)
        }

        if (!data.hasOwnProperty('shared') || !data.shared.hasOwnProperty(device)) {
            console.log('Could not find shared device with the id "' + device + '"')
            process.exit(1)
        }

        addPoint(data.device[device], 'battery_level', null, influxData)
        addPoint(data.device[device], 'current_humidity', null, influxData)
        addPoint(data.device[device], 'target_humidity', null, influxData)
        addPoint(data.device[device], 'learning_days_completed_heat', null, influxData)

        addPoint(data.shared[device], 'target_temperature', null, influxData, fToC)
        addPoint(data.shared[device], 'current_temperature', null, influxData, fToC)
        addPoint(data.shared[device], 'auto_away', 'auto_away_on', influxData)
        addPoint(data.shared[device], 'hvac_heater_state', 'heater_on', influxData, function (value) {
            if (value) {
                return 1
            }

            return 0
        })

        console.log(JSON.stringify(influxData))
        var resBody = ''

        var req = http.request(reqOptions, function (res) {
            res.on('data', function (data) {
                resBody += data.toString()
            })

            res.on('end', function () {
                if (res.statusCode != '200') {
                    console.log('Something bad happened with influx!')
                    console.log(resBody)
                    process.exit(1)
                }


                console.log('DONE!')
                console.log(resBody)
                process.exit(0)
            })
        })

        req.on('error', function (error) {
            console.log('Influx did not like us')
            console.log(error)
            process.exit(1)
        })

        req.write(JSON.stringify(influxData))
        req.end()
    })
})


var addPoint = function (source, point, name, destination, convertFunc) {
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