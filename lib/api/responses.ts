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
  | "forbidden"
  /** Alle Tipps sind schon geöffnet. */
  | "no_more_hints"
  /** Aufgeben vor dem letzten Tipp — die Regel setzt der Server durch. */
  | "hints_remaining"
  /** Eine gleichzeitige Anfrage hat den Attempt inzwischen verändert. */
  | "conflict";

export interface ApiError {
  readonly error: ApiErrorCode;
  readonly message: string;
}

const STATUS: Record<ApiErrorCode, number> = {
  invalid_request: 400,
  forbidden: 403,
  not_found: 404,
  already_answered: 409,
  no_more_hints: 409,
  hints_remaining: 409,
  conflict: 409,
  no_template: 422,
};

export function apiError(code: ApiErrorCode, message: string): NextResponse<ApiError> {
  return NextResponse.json({ error: code, message }, { status: STATUS[code] });
}
