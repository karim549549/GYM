import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface MappedError {
  status: number;
  code: string;
  message: string;
  details?: string[];
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private static readonly POSTGRES_ERRORS: Record<string, MappedError> = {
    '23505': {
      status: HttpStatus.CONFLICT,
      code: 'DUPLICATE_RECORD',
      message: 'This record already exists',
    },
    '23503': {
      status: HttpStatus.CONFLICT,
      code: 'REFERENCE_VIOLATION',
      message: 'This record is referenced by, or refers to, another record',
    },
    '23502': {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      code: 'CONSTRAINT_VIOLATION',
      message: 'The data breaks a database rule',
    },
    '23514': {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      code: 'CONSTRAINT_VIOLATION',
      message: 'The data breaks a database rule',
    },
    '22P02': {
      status: HttpStatus.BAD_REQUEST,
      code: 'INVALID_INPUT',
      message: 'A value has an invalid format',
    },
    // raised by the database's own client limit (check_client_limit), which no screen can get around
    GY001: {
      status: HttpStatus.CONFLICT,
      code: 'CLIENT_LIMIT_REACHED',
      message: 'The client limit of your plan is reached, upgrade to add more',
    },
    '40001': {
      status: HttpStatus.SERVICE_UNAVAILABLE,
      code: 'RETRY_LATER',
      message: 'The request conflicted with another one, try again',
    },
    '40P01': {
      status: HttpStatus.SERVICE_UNAVAILABLE,
      code: 'RETRY_LATER',
      message: 'The request conflicted with another one, try again',
    },
  };

  private static readonly INTERNAL_ERROR: MappedError = {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
  };

  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const { status, code, message, details } = this.map(exception);
    const requestId = (request as Request & { id?: string | number }).id;
    const path = (request.originalUrl ?? request.url).split('?')[0];

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const { message: reason, stack } = this.logTarget(exception);
      this.logger.error(`${path}: ${reason}`, stack);
    }

    response.status(status).json({
      statusCode: status,
      code,
      message,
      ...(details && { details }),
      path,
      ...(requestId !== undefined && { requestId: String(requestId) }),
    });
  }

  private map(exception: unknown): MappedError {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }
    return (
      this.findPostgresError(exception) ?? AllExceptionsFilter.INTERNAL_ERROR
    );
  }

  private fromHttpException(exception: HttpException): MappedError {
    const status = exception.getStatus();
    const body = exception.getResponse();
    const fallbackCode = HttpStatus[status] ?? 'HTTP_ERROR';

    if (typeof body === 'string') {
      return { status, code: fallbackCode, message: body };
    }

    const { code, message, details } = body as {
      code?: string;
      message?: unknown;
      details?: unknown;
    };
    if (Array.isArray(message)) {
      return {
        status,
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        details: message.map(String),
      };
    }
    return {
      status,
      code: code ?? fallbackCode,
      message: typeof message === 'string' ? message : exception.message,
      // a domain exception may say which parts of the request were wrong
      ...(Array.isArray(details) &&
        details.every((detail) => typeof detail === 'string') && { details }),
    };
  }

  private findPostgresError(error: unknown): MappedError | undefined {
    for (const link of this.causeChain(error)) {
      const code = (link as { code?: unknown }).code;
      if (
        typeof code === 'string' &&
        code in AllExceptionsFilter.POSTGRES_ERRORS
      ) {
        return AllExceptionsFilter.POSTGRES_ERRORS[code];
      }
    }
    return undefined;
  }

  private causeChain(error: unknown): unknown[] {
    const chain: unknown[] = [];
    let current = error;
    while (current && chain.length < 5) {
      chain.push(current);
      current = (current as { cause?: unknown }).cause;
    }
    return chain;
  }

  // A Drizzle wrapper error carries the SQL and its parameters in its message;
  // the innermost error is the one that is safe to log.
  private logTarget(exception: unknown): { message: string; stack?: string } {
    const errors = this.causeChain(exception).filter(
      (link): link is Error => link instanceof Error,
    );
    const root = errors[errors.length - 1];
    return root
      ? { message: root.message, stack: root.stack }
      : { message: String(exception) };
  }
}
