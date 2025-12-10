import { AgentSystem } from './agentSystem';
import { LogEntry } from './types';

export class WebSocketHandler {
  private ws: WebSocket | null = null;
  private agentSystem: AgentSystem | null = null;
  private maxLogEntries: number = 50;

  init(agentSystem: AgentSystem): void {
    this.agentSystem = agentSystem;
    this.connect()
  }

  connect(): void {
    const wsUrl = `ws`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (e) {
        console.error('Error parsing message:', e);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private handleMessage(message: any): void {
    // Handle incoming messages here
    if (message.type === 'log_entry' && this.agentSystem) {
      const logEntry: LogEntry = message.data;
      this.agentSystem.initNewAgent(JSON.stringify(message.data));
      this.addLogEntryToUI(logEntry);
    }
  }

  private parseUserAgent(userAgent: string): string {
    if (/iPad/i.test(userAgent)) {
      return 'iPad';
    } else if (/iPhone/i.test(userAgent)) {
      return 'iPhone';
    } else if (/Android/i.test(userAgent)) {
      return 'Android';
    } else if (/Mobile|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
      return 'Mobile';
    } else if (/Macintosh/i.test(userAgent)) {
      return 'Mac';
    } else if (/Windows/i.test(userAgent)) {
      return 'PC';
    } else if (/Linux/i.test(userAgent)) {
      return 'Linux';
    } else {
      return 'Unknown';
    }
  }

  private addLogEntryToUI(entry: LogEntry): void {
    const activityLog = document.getElementById('activity-log');
    if (!activityLog) return;

    // Remove "waiting" message if it exists
    const waitingMsg = activityLog.querySelector('[style*="text-align: center"]');
    if (waitingMsg) {
      waitingMsg.remove();
    }

    // Create log entry element
    const logDiv = document.createElement('div');
    logDiv.className = 'log-entry';
    
    const statusClass = entry.status_code >= 400 ? 'error' : '';
    const userAgentParsed = this.parseUserAgent(entry.user_agent).toUpperCase();
    
    logDiv.innerHTML = `
      <span class="log-status ${statusClass}">${entry.status_code}</span> | 
      <span class="log-country">${entry.country || 'Unknown'}</span> | 
      <span class="log-method">${entry.method}</span> | 
      <span class="log-useragent">${userAgentParsed}</span> 
      <span class="log-url">${entry.url}</span>
    `;

    // Add tooltip with full log details
    logDiv.title = `${entry.status_code} | ${entry.country || 'Unknown'} | ${entry.method} | ${entry.user_agent} | ${entry.url}`;

    // Add to top of DOM (appears at top visually)
    activityLog.insertBefore(logDiv, activityLog.firstChild);

    // Keep only the most recent entries (remove from bottom)
    while (activityLog.children.length > this.maxLogEntries) {
      activityLog.removeChild(activityLog.lastChild!);
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
