export interface LogEntry {
    ip: string;
    method: string;
    url: string;
    status_code: number;
    size: number;
    timestamp: string;
    user_agent: string;
    referer: string;
    country: string;
}
