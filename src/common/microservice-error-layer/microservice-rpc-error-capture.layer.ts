import { BadRequestException, Catch } from "@nestjs/common";
import { RpcExceptionFilter } from "@nestjs/common";
import { Observable, throwError } from "rxjs";

@Catch(BadRequestException)
export class MicroserviceRpcErrorCaptureLayer implements RpcExceptionFilter<BadRequestException> {
  catch(exception: BadRequestException): Observable<never> {
    const response = exception.getResponse() as
      string | { message?: string | string[] };

    const message =
      typeof response === "string"
        ? [response]
        : Array.isArray(response?.message)
          ? response.message
          : response?.message
            ? [response.message]
            : [exception.message];

    return throwError(() => ({
      status: 400,
      message,
    }));
  }
}
