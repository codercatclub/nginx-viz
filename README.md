# Realtime NGINX Log Visualizer
In the style of "Defend your Castle" -- monitor incoming requests as they approach your castle. Probable bots and malicious agents are signaled by avatar. Defense mechanisms include adjusting your NGINX config!

## Quick Start 

1. Download the ```nginxviz``` binary from Releases. 

2. Pipe the NGINX Log from your server to a local file in the same directory as ```nginxviz```.

```ssh -t {serverName} sudo tail -f /var/log/nginx/access.log | tee mylog.log```

3. Run ```nginxviz``` and open [http://127.0.0.1:9000](http://127.0.0.1:9000) in any browser to view the visualizer
```
sudo chmod +x nginxviz
./nginxviz
```
