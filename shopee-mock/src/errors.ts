export class ShopeeMockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShopeeMockError";
  }
}

export class ShopeeMockApiError extends Error {
  public readonly status: number;
  public readonly errorCode: string;

  constructor(status: number, errorCode: string, message: string) {
    super(message);
    this.name = "ShopeeMockApiError";
    this.status = status;
    this.errorCode = errorCode;
  }
}
