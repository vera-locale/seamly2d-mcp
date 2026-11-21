export type DomainErrorCode =
  | 'DUPLICATE_SYMBOL'
  | 'UNDECLARED_SYMBOL'
  | 'FORWARD_REFERENCE'
  | 'SELF_REFERENCE'
  | 'INVALID_SYMBOL_KIND'
  | 'INVALID_INCREMENT_NAME'
  | 'DUPLICATE_INCREMENT_NAME'
  | 'DUPLICATE_DRAW_BLOCK'
  | 'EMPTY_DRAW_BLOCKS'
  | 'EMPTY_CONTOUR'
  | 'INVALID_FORMULA'
  | 'INVALID_VALUE';

export type DomainErrorContext = Record<string, string | number | boolean>;

export class DomainValidationError extends Error {
  public readonly code: DomainErrorCode;
  public readonly context: DomainErrorContext | undefined;

  public constructor(code: DomainErrorCode, message: string, context?: DomainErrorContext) {
    super(message);
    this.name = 'DomainValidationError';
    this.code = code;
    this.context = context;
  }
}
