export class ApprovalRequiredError extends Error {
  readonly code = "APPROVAL_REQUIRED";

  constructor(message = "Counsel approval is required before this operation.") {
    super(message);
    this.name = "ApprovalRequiredError";
  }
}

export class LowEvidenceError extends Error {
  readonly code = "NOT_ENOUGH_INFORMATION";

  constructor(message = "Not enough information in the corpus.") {
    super(message);
    this.name = "LowEvidenceError";
  }
}
