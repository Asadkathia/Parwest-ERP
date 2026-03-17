declare module "compromise" {
  interface CompromiseEntity {
    text(): string
  }

  interface CompromiseMatch {
    forEach(cb: (value: CompromiseEntity) => void): void
  }

  interface CompromiseDoc {
    people(): CompromiseMatch
    organizations(): CompromiseMatch
  }

  type CompromiseNlp = (text: string) => CompromiseDoc
  const nlp: CompromiseNlp
  export default nlp;
}
