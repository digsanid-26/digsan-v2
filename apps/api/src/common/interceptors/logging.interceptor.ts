import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request || !request.method) return next.handle();

    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '-';
    const userId = (request as any).user?.id || 'anonymous';
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const statusCode = response?.statusCode;
          const duration = Date.now() - now;
          this.logger.log(
            `${method} ${url} ${statusCode} ${duration}ms - ${userId} - ${ip} - ${userAgent}`,
          );
        },
        error: (err) => {
          const duration = Date.now() - now;
          const status = err?.status || err?.getStatus?.() || 500;
          this.logger.warn(
            `${method} ${url} ${status} ${duration}ms - ${userId} - ${ip} - ${err?.message}`,
          );
        },
      }),
    );
  }
}
