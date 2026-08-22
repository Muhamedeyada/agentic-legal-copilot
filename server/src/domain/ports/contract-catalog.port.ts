export interface ContractSummary {
  readonly id: string;
  readonly title: string;
  readonly language: "ar" | "en";
  readonly source: "corpus" | "upload";
  readonly contractType?: string;
  readonly highRisk?: boolean;
}

export interface ContractRecord extends ContractSummary {
  readonly text: string;
}

export interface ContractCatalogPort {
  list(): Promise<readonly ContractSummary[]>;
  get(id: string): Promise<ContractRecord | undefined>;
  saveUpload(input: {
    title: string;
    language: "ar" | "en";
    text: string;
  }): Promise<ContractRecord>;
}
