## NestFlux

Gets some basic info from your [Nest](https://nest.com/) thermostat and [Weather Underground](http://www.wunderground.com/) then inserts the
data into [InfluxDB](http://influxdb.com/).

Why? I like to query and mashup this stuff with other sources of information, like [Weather Underground](http://www.wunderground.com/).
You can then use tools like [Grafana](http://grafana.org/) to do all sorts of fun things.

This code is not super duper flexible or very clean. It was a weekend hack to get some data to play with.
Feel free to contribute!

## Usage

- Git clone the repo
- copy `settings.sh.example` to `settings.sh`
- Edit `settings.sh` putting your info into the variables
- Run `./bin/nestflux.sh` or put it in upstart/cron/etc
- Rejoice!