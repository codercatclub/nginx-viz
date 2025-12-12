# Realtime NGINX Log Visualizer
In the style of "Defend your Castle" -- monitor incoming requests as they approach your server. Probable bots and malicious agents are signaled by avatar. Defense mechanisms include adjusting your NGINX config!

This app development started when we noticed 100+ requests from Open AI bots crawling our website. We felt the need to fight back, and generally understand the invisible landscape of the internet around us. Future developments include the ability to adjust your config directly through the app, providing a real-time defense strategy:) 

## Quick Start 

1. Download the ```nginxviz``` binary from Github Releases. 

2. Pipe the NGINX Log from your server to a local file.

```ssh -t {serverName} sudo tail -f /var/log/nginx/access.log | tee mylog.log```

3. Run ```nginxviz``` and open [http://127.0.0.1:9000](http://127.0.0.1:9000) in any browser to view the visualizer
```
sudo chmod +x nginxviz
./nginxviz
```

By default the app is looking for a logfile in the current directory named ```mylog.log```. You can provide a custom log file using the ```-i``` command line argument. 

For example if you are running the visualizer directly on your server:
```
./nginxviz -i /var/log/nginx/access.log
```
