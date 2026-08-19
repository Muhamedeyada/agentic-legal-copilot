export class ApprovalRequiredError extends Error {
  readonly code = "APPROVAL_REQUIRED";

  constructor(message = "Counsel approval is required before this operation.") {
    super(message);
    this.name = "ApprovalRequiredError";
  }
}
