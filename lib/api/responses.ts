import { NextResponse } from "next/server";

/**
 * Einheitliche Fehlerantworten. Die Nachricht ist für Entwickler, nicht für
 * Endnutzer — und sie verrät nie etwas über die Lösung einer offenen Aufgabe.
 */

export type ApiErrorCode =
  | "invalid_request"
  | "not_found"
  | "already_answered"
  | "no_template"
  | "forbidden";

export interface ApiError {
  readonly error: ApiErrorCode;
  readonly message: string;
}

const STATUS: Record<ApiErrorCode, number> = {
  invalid_request: 400,
  forbidden: 403,
  not_found: 404,
  already_answered: 409,
  no_template: 422,
};

export function apiError(code: ApiErrorCode, message: string): NextResponse<ApiError> {
  return NextResponse.json({ error: code, message }, { status: STATUS[code] });
}
