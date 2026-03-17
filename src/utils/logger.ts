/**
 * Simple logger utility for claude-memd
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

class Logger {
  private static level: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

  private static shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[Logger.level];
  }

  private static formatLog(level: LogLevel, message: string, data?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(5, ' ');
    let log = `[${timestamp}] [${levelStr}] ${message}`;
    if (data) {
      log += ` ${JSON.stringify(data)}`;
    }
    return log;
  }

  static debug(message: string, data?: Record<string, unknown>): void {
    if (Logger.shouldLog('debug')) {
      console.error(Logger.formatLog('debug', message, data));
    }
  }

  static info(message: string, data?: Record<string, unknown>): void {
    if (Logger.shouldLog('info')) {
      console.error(Logger.formatLog('info', message, data));
    }
  }

  static warn(message: string, data?: Record<string, unknown>): void {
    if (Logger.shouldLog('warn')) {
      console.error(Logger.formatLog('warn', message, data));
    }
  }

  static error(message: string, data?: Record<string, unknown>): void {
    if (Logger.shouldLog('error')) {
      console.error(Logger.formatLog('error', message, data));
    }
  }
}

export const logger = {
  debug: (message: string, data?: Record<string, unknown>) => Logger.debug(message, data),
  info: (message: string, data?: Record<string, unknown>) => Logger.info(message, data),
  warn: (message: string, data?: Record<string, unknown>) => Logger.warn(message, data),
  error: (message: string, data?: Record<string, unknown>) => Logger.error(message, data),
};
