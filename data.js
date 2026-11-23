// @ts-check
/**
 * Single source of truth for the page: table types, needs and tips.
 * Checked against the public Google Cloud documentation on 2026-11-23.
 *
 * @typedef {'direct'|'via'|'preview'|'none'|'outside'} RouteKind
 *   direct  - the engine works on the table itself
 *   via     - the engine goes through BigQuery, and BigQuery does the work
 *   preview - works directly, but the feature is in Preview
 *   none    - not possible
 *   outside - the engine works on the files without the table being involved
 * @typedef {{ kind: RouteKind, label?: string, note: string }} Route
 * @typedef {{ ok: boolean, note?: string }} Rule
 * @typedef {'yes'|'partial'|'no'} FitLevel
 * @typedef {{ level: FitLevel, why?: string }} Fit
 * @typedef {'direct'|'bqsql'|'stream'|'directread'|'openfiles'|'othercloud'|'remotecatalog'|'hivemigrate'|'unstructured'|'finegrained'|'policytags'} NeedId
 * @typedef {'engines'|'storage'|'catalog'|'security'} NeedGroup
 * @typedef {{
 *   id: string, name: string, short: string, group: 'bigquery'|'runtime',
 *   tag?: string, badge?: string, preferred?: boolean, legacy?: boolean, summary: string, saves: string,
 *   otherEngine: string,
 *   catalog: { title: string, sub: string, owner: 'bigquery'|'runtime'|'self' },
 *   storage: { title: string, sub: string, where: 'managed'|'yours'|'remote' },
 *   write: { bq: Route, other: Route }, read: { bq: Route, other: Route },
 *   security: { row: Rule, column: Rule, masking: Rule, tags: Rule, note: string },
 *   know: string[], bestFor: string, doc: string,
 *   fit: Record<NeedId, Fit>
 * }} TableType
 */
(function (root) {
  const DOCS = 'https://docs.cloud.google.com';

  /** @type {{ id: NeedGroup, label: string }[]} */
  const NEED_GROUPS = [
    { id: 'engines', label: 'Engines & access' },
    { id: 'storage', label: 'Data & storage' },
    { id: 'catalog', label: 'Catalog' },
    { id: 'security', label: 'Security' },
  ];

  /** `chip` is the short label on the button. `label` is the full sentence. @type {{ id: NeedId, group: NeedGroup, chip: string, label: string, hint: string }[]} */
  const NEEDS = [
    { id: 'direct', group: 'engines', chip: 'Engines write directly', label: 'Spark, Flink or Trino write straight to the table', hint: 'They save their own changes. BigQuery is not in the write path.' },
    { id: 'bqsql', group: 'engines', chip: 'BigQuery SQL writes', label: 'BigQuery SQL changes the data', hint: 'INSERT, UPDATE, DELETE and MERGE.' },
    { id: 'stream', group: 'engines', chip: 'Stream in via BigQuery', label: 'Stream rows in through BigQuery', hint: 'Uses the BigQuery Storage Write API.' },
    { id: 'directread', group: 'engines', chip: 'Read without BigQuery API', label: 'Spark, Flink or Trino read without the BigQuery API', hint: 'Open engines read the table from storage via the catalog, without going through the BigQuery Storage Read API.' },
    { id: 'openfiles', group: 'storage', chip: 'Open files in my bucket', label: 'Open-format files in my own bucket', hint: 'Parquet or Iceberg files that you own.' },
    { id: 'othercloud', group: 'storage', chip: 'Stays in another cloud', label: 'Data stays in another cloud', hint: 'Amazon S3, Azure or another data platform.' },
    { id: 'unstructured', group: 'storage', chip: 'Documents or media', label: 'The files are documents or media', hint: 'PDFs, images, audio or video.' },
    { id: 'remotecatalog', group: 'catalog', chip: 'Another catalog owns it', label: 'Another platform\'s catalog owns the tables', hint: 'For example Databricks Unity Catalog, Snowflake or AWS Glue.' },
    { id: 'hivemigrate', group: 'catalog', chip: 'Hive Metastore today', label: 'I am moving off a Hive Metastore', hint: 'Existing Spark and Hive jobs that expect a metastore.' },
    { id: 'finegrained', group: 'security', chip: 'Row and column rules', label: 'Row filters and column masking', hint: 'Different people see different rows or masked values.' },
    { id: 'policytags', group: 'security', chip: 'Policy tags', label: 'Policy tags', hint: 'Tag sensitive columns once and control access by tag.' },
  ];

  const STRUCTURED_ONLY = 'Built for rows and columns, not documents or media.';
  const GCS_ONLY = 'The files live in Cloud Storage.';

  /** @type {TableType[]} */
  const TYPES = [
    {
      id: 'standard',
      name: 'BigQuery standard tables',
      short: 'Standard table',
      group: 'bigquery',
      summary: 'BigQuery stores the data and runs everything. Other engines load and read data through BigQuery.',
      saves: 'BigQuery',
      otherEngine: 'Spark · Flink · Trino',
      catalog: { title: 'BigQuery catalog', sub: 'keeps the table definition', owner: 'bigquery' },
      storage: { title: 'BigQuery storage', sub: 'managed for you', where: 'managed' },
      write: {
        bq: { kind: 'direct', note: 'SQL (INSERT, UPDATE, DELETE, MERGE), load jobs and the BigQuery Storage Write API.' },
        other: { kind: 'via', note: 'Spark, Flink and Dataflow connectors send rows to BigQuery through the Storage Write API, and BigQuery saves them. Engines cannot write the table\'s storage themselves.' },
      },
      read: {
        bq: { kind: 'direct', note: 'Standard SQL queries.' },
        other: { kind: 'via', note: 'Spark, Flink and Trino connectors read through the BigQuery Storage Read API.' },
      },
      security: {
        row: { ok: true }, column: { ok: true }, masking: { ok: true }, tags: { ok: true },
        note: 'The full BigQuery set, including authorized views and data sharing.',
      },
      know: [
        'The data lives in BigQuery storage, not as files in your own bucket.',
        'Supports table clones and table snapshots.',
        'Data governance tags (Preview) are a newer way to control column access by tag, alongside policy tags.',
      ],
      bestFor: 'Analytics and BI where BigQuery is the main engine.',
      doc: DOCS + '/bigquery/docs/tables-intro',
      fit: {
        direct: { level: 'no', why: 'Engines send rows through BigQuery. They cannot write the table themselves.' },
        bqsql: { level: 'yes' },
        stream: { level: 'yes' },
        openfiles: { level: 'no', why: 'The data lives in BigQuery storage.' },
        othercloud: { level: 'no', why: 'The data is loaded into BigQuery storage.' },
        finegrained: { level: 'yes' },
        policytags: { level: 'yes' },
        directread: { level: 'no', why: 'Reads go through the BigQuery Storage Read API.' },
        remotecatalog: { level: 'no', why: 'The data would have to be loaded into BigQuery.' },
        hivemigrate: { level: 'no', why: 'You would load the data into BigQuery instead.' },
        unstructured: { level: 'no', why: STRUCTURED_ONLY },
      },
    },
    {
      id: 'managed',
      name: 'Apache Iceberg managed tables',
      short: 'Iceberg managed table',
      group: 'bigquery',
      summary: 'BigQuery runs the table like a standard table, but keeps the data as open Iceberg files in your own bucket.',
      saves: 'BigQuery',
      otherEngine: 'Spark · Flink · Trino',
      catalog: { title: 'BigQuery catalog', sub: 'owns every change', owner: 'bigquery' },
      storage: { title: 'Your Cloud Storage bucket', sub: 'Parquet + Iceberg snapshot', where: 'yours' },
      write: {
        bq: { kind: 'direct', note: 'SQL and the BigQuery Storage Write API.' },
        other: { kind: 'via', note: 'Connectors such as Spark and Dataflow send rows to BigQuery through the Storage Write API. Engines must not write the Iceberg files themselves.' },
      },
      read: {
        bq: { kind: 'direct', note: 'Standard SQL queries.' },
        other: { kind: 'via', note: 'Read through BigQuery connectors. Engines can also read the Iceberg snapshot that BigQuery exports to your bucket, read-only.' },
      },
      security: {
        row: { ok: true }, column: { ok: true }, masking: { ok: true }, tags: { ok: true },
        note: 'Same rules as standard tables. Authorized views are not supported.',
      },
      know: [
        'Changing the files from outside BigQuery can break the table or lose data.',
        'Table clones, table snapshots and authorized views are not supported.',
        'BigQuery exports Iceberg version 2 metadata after each change.',
      ],
      bestFor: 'BigQuery-first teams that want their data in an open format they own.',
      doc: DOCS + '/bigquery/docs/biglake-iceberg-tables-in-bigquery',
      fit: {
        direct: { level: 'no', why: 'Only BigQuery saves changes. Engines send rows through BigQuery instead.' },
        bqsql: { level: 'yes' },
        stream: { level: 'yes' },
        openfiles: { level: 'yes' },
        othercloud: { level: 'no', why: GCS_ONLY },
        finegrained: { level: 'yes' },
        policytags: { level: 'yes' },
        directread: { level: 'partial', why: 'Read-only via the exported Iceberg snapshot, which skips BigQuery security rules.' },
        remotecatalog: { level: 'no', why: 'BigQuery manages this table itself.' },
        hivemigrate: { level: 'no', why: 'It does not stand in for a Hive Metastore.' },
        unstructured: { level: 'no', why: STRUCTURED_ONLY },
      },
    },
    {
      id: 'biglake',
      name: 'BigLake tables',
      short: 'BigLake table',
      group: 'bigquery',
      summary: 'A read-only BigQuery table over files you already have. People query the table without getting access to the files.',
      saves: 'Nobody. The table only reads your files',
      otherEngine: 'Other engines',
      catalog: { title: 'BigQuery catalog', sub: 'table definition', owner: 'bigquery' },
      storage: { title: 'Your files', sub: 'Cloud Storage · S3 · Azure', where: 'yours' },
      write: {
        bq: { kind: 'none', note: 'Read-only. BigQuery never changes your files.' },
        other: { kind: 'outside', note: 'Your jobs add or replace files in the bucket. The table reads whatever is there, so nothing coordinates those writes.' },
      },
      read: {
        bq: { kind: 'direct', note: 'Queries Cloud Storage directly, and Amazon S3 or Azure through BigQuery Omni.' },
        other: { kind: 'via', note: 'Spark, Hive and Trino read through BigQuery connectors, with the same security rules. This works for Cloud Storage data only.' },
      },
      security: {
        row: { ok: true }, column: { ok: true }, masking: { ok: true }, tags: { ok: true },
        note: 'BigQuery reads the files through a connection, so users never need access to the bucket.',
      },
      know: [
        'Works with Parquet, ORC, Avro, CSV, JSON, Delta Lake and Iceberg files.',
        'Read-only: no INSERT, UPDATE or DELETE.',
        'Connector reads are not available for data in AWS or Azure.',
      ],
      bestFor: 'Governed SQL access to raw files in a data lake.',
      doc: DOCS + '/bigquery/docs/biglake-intro',
      fit: {
        direct: { level: 'partial', why: 'Jobs can write files to the bucket, but nothing coordinates them with the table.' },
        bqsql: { level: 'no', why: 'Read-only in BigQuery.' },
        stream: { level: 'no', why: 'Read-only in BigQuery.' },
        openfiles: { level: 'yes' },
        othercloud: { level: 'yes', why: 'Amazon S3 and Azure, through BigQuery Omni.' },
        finegrained: { level: 'yes' },
        policytags: { level: 'yes' },
        directread: { level: 'partial', why: 'Engines can open the raw files, but that skips the table and its security rules.' },
        remotecatalog: { level: 'partial', why: 'It reads the files but not the other platform\'s catalog, so it does not follow table changes.' },
        hivemigrate: { level: 'partial', why: 'BigQuery can query Hive-style files, but Spark and Hive still need a metastore.' },
        unstructured: { level: 'no', why: STRUCTURED_ONLY },
      },
    },
    {
      id: 'external',
      name: 'Apache Iceberg external tables',
      short: 'Iceberg external table',
      group: 'bigquery',
      tag: 'No longer recommended',
      badge: 'Legacy',
      legacy: true,
      summary: 'BigQuery reads an Iceberg table that another system writes. You point BigQuery at the table\'s metadata file and update that pointer yourself.',
      saves: 'Another system, outside Google Cloud\'s catalogs',
      otherEngine: 'Other engines',
      catalog: { title: 'BigQuery table definition', sub: 'points to a metadata file', owner: 'self' },
      storage: { title: 'Your Iceberg files', sub: 'Cloud Storage · S3 · Azure', where: 'yours' },
      write: {
        bq: { kind: 'none', note: 'Read-only in BigQuery.' },
        other: { kind: 'outside', note: 'Engines write the Iceberg table with their own catalog. BigQuery sees new data only after you update the pointer.' },
      },
      read: {
        bq: { kind: 'direct', note: 'Standard SQL queries, as of the metadata file you pointed to.' },
        other: { kind: 'outside', note: 'Engines read the Iceberg files with their own catalog, without BigQuery\'s security rules.' },
      },
      security: {
        row: { ok: true }, column: { ok: true }, masking: { ok: true }, tags: { ok: true },
        note: 'Rules apply to BigQuery queries only.',
      },
      know: [
        'Google no longer recommends this type for most use cases.',
        'For tables managed by Databricks, Snowflake or AWS Glue, use a federated catalog instead.',
        'Still the option for Iceberg tables in Azure, or tables with no supported catalog.',
      ],
      bestFor: 'Existing setups, and Iceberg tables that no supported catalog manages.',
      doc: DOCS + '/bigquery/docs/iceberg-external-tables',
      fit: {
        direct: { level: 'partial', why: 'Engines write with their own catalog, and you update BigQuery\'s pointer by hand.' },
        bqsql: { level: 'no', why: 'Read-only in BigQuery.' },
        stream: { level: 'no', why: 'Read-only in BigQuery.' },
        openfiles: { level: 'yes' },
        othercloud: { level: 'yes' },
        finegrained: { level: 'yes', why: 'Rules apply to BigQuery queries only.' },
        policytags: { level: 'yes' },
        directread: { level: 'partial', why: 'Engines read with their own catalog, which skips BigQuery\'s security rules.' },
        remotecatalog: { level: 'partial', why: 'You point at the table\'s metadata file by hand. A federated catalog follows it for you.' },
        hivemigrate: { level: 'no', why: 'It does not stand in for a Hive Metastore.' },
        unstructured: { level: 'no', why: STRUCTURED_ONLY },
      },
    },
    {
      id: 'object',
      name: 'Object tables',
      short: 'Object table',
      group: 'bigquery',
      summary: 'A read-only list of your files in Cloud Storage, one row per file. Use it to run SQL, AI and ML functions over documents, images, audio and video.',
      saves: 'Nobody. Apps change the files in the bucket',
      otherEngine: 'Your apps',
      catalog: { title: 'BigQuery catalog', sub: 'one row per file', owner: 'bigquery' },
      storage: { title: 'Your Cloud Storage bucket', sub: 'PDFs · images · audio · video', where: 'yours' },
      write: {
        bq: { kind: 'none', note: 'Read-only. You cannot change files through the table.' },
        other: { kind: 'outside', note: 'Apps upload or delete files in the bucket. The table lists what is there.' },
      },
      read: {
        bq: { kind: 'direct', note: 'SQL over the file list, plus AI and ML functions over the file contents.' },
        other: { kind: 'outside', note: 'Apps open the files from the bucket, or through signed URLs that BigQuery generates.' },
      },
      security: {
        row: { ok: true, note: 'Controls which files each person can see.' },
        column: { ok: false }, masking: { ok: false }, tags: { ok: false },
        note: 'BigQuery reads the files through a connection, as BigLake tables do.',
      },
      know: [
        'The only table type here for unstructured data.',
        'Read-only.',
        'Not available for files in AWS or Azure.',
      ],
      bestFor: 'Analysing documents and media with SQL and AI functions.',
      doc: DOCS + '/bigquery/docs/object-table-introduction',
      fit: {
        direct: { level: 'no', why: 'It is a read-only list of files.' },
        bqsql: { level: 'no', why: 'Read-only in BigQuery.' },
        stream: { level: 'no', why: 'Read-only in BigQuery.' },
        openfiles: { level: 'no', why: 'It lists files. It is not a table format.' },
        othercloud: { level: 'no', why: 'Not available for files in AWS or Azure.' },
        finegrained: { level: 'partial', why: 'Row filters only. They control which files a person sees.' },
        policytags: { level: 'no', why: 'The columns are fixed file details, so there is nothing to tag.' },
        directread: { level: 'no', why: 'It is a list of files, not a table that engines read.' },
        remotecatalog: { level: 'no', why: 'It lists files in your own Cloud Storage bucket.' },
        hivemigrate: { level: 'no', why: 'It does not stand in for a Hive Metastore.' },
        unstructured: { level: 'yes' },
      },
    },
    {
      id: 'runtime',
      name: 'Apache Iceberg tables in the Lakehouse runtime catalog',
      short: 'Iceberg REST table',
      group: 'runtime',
      tag: 'Recommended for new open tables',
      badge: 'Recommended',
      preferred: true,
      summary: 'An open Iceberg table that many engines share. Spark, Flink, Trino and BigQuery all work on the same files in your bucket.',
      saves: 'Whichever engine writes. The catalog keeps the changes in order',
      otherEngine: 'Spark · Flink · Trino',
      catalog: { title: 'Lakehouse runtime catalog', sub: 'Iceberg REST endpoint', owner: 'runtime' },
      storage: { title: 'Your Cloud Storage bucket', sub: 'Parquet + Iceberg metadata', where: 'yours' },
      write: {
        bq: { kind: 'preview', note: 'SQL writes (INSERT, UPDATE, DELETE, MERGE) are in Preview. The BigQuery Storage Write API is not available for this table type.' },
        other: { kind: 'direct', note: 'Spark, Flink and Trino write straight to the table. The catalog keeps their changes in order.' },
      },
      read: {
        bq: { kind: 'direct', note: 'Standard SQL with a four-part name: project.catalog.namespace.table.' },
        other: { kind: 'direct', note: 'Spark, Flink and Trino read the same files through the catalog.' },
      },
      security: {
        row: { ok: true }, column: { ok: true }, masking: { ok: true },
        tags: { ok: false, note: 'Attach data policies to columns with SQL instead.' },
        note: 'You set the rules with BigQuery SQL, and they apply to BigQuery queries. Turn on credential vending: other engines can then open a protected table only if the caller may see every row and every unmasked column.',
      },
      know: [
        'Policy tags and data governance tags are not supported. You attach data policies to columns with BigQuery SQL.',
        'Without credential vending, anyone with bucket access can read the files and skip the rules.',
        'Iceberg views are in Preview and work from open engines only.',
        'Existing Spark or Flink setups tied to 3-part BigQuery dataset names (project.dataset.table) can still use the legacy custom Iceberg catalog plugin (BigQueryMetastoreCatalog), but Google recommends this Iceberg REST endpoint for all new workloads.',
      ],
      bestFor: 'New lakehouse tables that several engines read and write.',
      doc: DOCS + '/lakehouse/docs/about-lakehouse-catalogs',
      fit: {
        direct: { level: 'yes' },
        bqsql: { level: 'partial', why: 'BigQuery SQL writes are in Preview.' },
        stream: { level: 'no', why: 'The Storage Write API is not available. Stream with an open engine instead.' },
        openfiles: { level: 'yes' },
        othercloud: { level: 'no', why: GCS_ONLY },
        finegrained: { level: 'yes', why: 'Rules apply to BigQuery queries. Turn on credential vending so other engines cannot skip them.' },
        policytags: { level: 'no', why: 'Uses data policies attached directly to columns.' },
        directread: { level: 'yes' },
        remotecatalog: { level: 'no', why: 'This catalog manages the table itself. Use a federated catalog for tables another platform owns.' },
        hivemigrate: { level: 'partial', why: 'Fits once the tables are Iceberg tables. Hive-style tables belong on the Hive endpoint.' },
        unstructured: { level: 'no', why: STRUCTURED_ONLY },
      },
    },
    {
      id: 'hive',
      name: 'Apache Hive tables in the Lakehouse runtime catalog',
      short: 'Hive table',
      group: 'runtime',
      summary: 'A managed stand-in for a Hive Metastore. Spark and Hive keep using Hive-style tables, with no metastore servers to run.',
      saves: 'Spark or Hive, through the catalog',
      otherEngine: 'Spark · Hive',
      catalog: { title: 'Lakehouse runtime catalog', sub: 'Hive endpoint', owner: 'runtime' },
      storage: { title: 'Your Cloud Storage bucket', sub: 'Parquet · ORC · Avro · Delta', where: 'yours' },
      write: {
        bq: { kind: 'none', note: 'BigQuery can query these tables but cannot change them.' },
        other: { kind: 'direct', note: 'Spark and Hive write as they do with a Hive Metastore. Trino is not supported on this endpoint.' },
      },
      read: {
        bq: { kind: 'direct', note: 'Standard SQL queries, read-only.' },
        other: { kind: 'direct', note: 'Spark and Hive read through the catalog.' },
      },
      security: {
        row: { ok: false }, column: { ok: false }, masking: { ok: false }, tags: { ok: false },
        note: 'Access is controlled with IAM permissions only. There are no row or column rules.',
      },
      know: [
        'Built for existing workloads that depend on the Hive Metastore interface.',
        'Trino is not supported, and Kerberos clusters cannot connect.',
        'For new tables, Google recommends Iceberg in the runtime catalog.',
      ],
      bestFor: 'Moving existing Hive and Spark workloads without running a metastore.',
      doc: DOCS + '/lakehouse/docs/about-spark-hive-metastore',
      fit: {
        direct: { level: 'partial', why: 'Spark and Hive write. Trino is not supported.' },
        bqsql: { level: 'no', why: 'BigQuery can only read these tables.' },
        stream: { level: 'no', why: 'BigQuery can only read these tables.' },
        openfiles: { level: 'yes' },
        othercloud: { level: 'no', why: GCS_ONLY },
        finegrained: { level: 'no', why: 'IAM permissions only.' },
        policytags: { level: 'no', why: 'IAM permissions only.' },
        directread: { level: 'yes', why: 'Spark and Hive.' },
        remotecatalog: { level: 'no', why: 'This catalog manages the table itself.' },
        hivemigrate: { level: 'yes' },
        unstructured: { level: 'no', why: STRUCTURED_ONLY },
      },
    },
    {
      id: 'federated',
      name: 'Tables in federated catalogs',
      short: 'Federated table',
      group: 'runtime',
      summary: 'Query tables that live on another platform, in place. Google Cloud mirrors the remote catalog\'s table list and reads the files where they are.',
      saves: 'The remote platform',
      otherEngine: 'Apache Spark',
      catalog: { title: 'Lakehouse runtime catalog', sub: 'mirror of a remote catalog', owner: 'runtime' },
      storage: { title: 'Remote platform', sub: 'Databricks · Snowflake · AWS', where: 'remote' },
      write: {
        bq: { kind: 'none', label: 'remote side writes', note: 'Read-only on Google Cloud.' },
        other: { kind: 'none', label: 'remote side writes', note: 'Read-only on Google Cloud. The remote platform does all the writing.' },
      },
      read: {
        bq: { kind: 'direct', note: 'Standard SQL queries, with no data copied.' },
        other: { kind: 'direct', note: 'Managed Service for Apache Spark and open-source Spark.' },
      },
      security: {
        row: { ok: false }, column: { ok: false }, masking: { ok: false }, tags: { ok: false },
        note: 'Table-level IAM on Google Cloud. For Databricks Unity Catalog, queries can run as the signed-in user, so Databricks applies its own permissions.',
      },
      know: [
        'Nothing is copied or migrated.',
        'The table list refreshes in the background, so new tables can take a while to appear.',
        'An optional cache keeps recently read data in Google Cloud to cut cross-cloud transfer costs.',
      ],
      bestFor: 'Joining data on Databricks, Snowflake or AWS with data on Google Cloud.',
      doc: DOCS + '/lakehouse/docs/about-cross-cloud-data-access',
      fit: {
        direct: { level: 'no', why: 'Read-only on Google Cloud.' },
        bqsql: { level: 'no', why: 'Read-only on Google Cloud.' },
        stream: { level: 'no', why: 'Read-only on Google Cloud.' },
        openfiles: { level: 'partial', why: 'The files stay in the remote platform\'s storage.' },
        othercloud: { level: 'yes' },
        finegrained: { level: 'no', why: 'Table-level IAM only on Google Cloud.' },
        policytags: { level: 'no', why: 'Table-level IAM only on Google Cloud.' },
        directread: { level: 'yes', why: 'Spark reads the remote files in place.' },
        remotecatalog: { level: 'yes' },
        hivemigrate: { level: 'no', why: 'It does not stand in for a Hive Metastore.' },
        unstructured: { level: 'no', why: STRUCTURED_ONLY },
      },
    },
  ];

  /** Shown when every listed need is selected. First match wins. @type {{ when: NeedId[], text: string }[]} */
  const TIPS = [
    { when: ['direct', 'stream'], text: 'These two pull apart. Either engines write the table themselves, or they send rows through BigQuery. No table type does both, so decide who owns the writes.' },
    { when: ['direct', 'policytags'], text: 'No table type has both. A common split: keep sensitive tables as Iceberg managed tables with policy tags, and the rest as Iceberg tables in the runtime catalog.' },
    { when: ['direct', 'finegrained'], text: 'Iceberg tables in the runtime catalog do this, with one catch: masks and row filters apply to BigQuery queries. If Spark itself must read masked data, use Iceberg managed tables and read through the BigQuery connector.' },
    { when: ['othercloud', 'bqsql'], text: 'Data that stays in another cloud is read-only from Google Cloud. To change it with BigQuery SQL, it has to live on Google Cloud.' },
    { when: ['othercloud', 'stream'], text: 'Data that stays in another cloud is read-only from Google Cloud. Streaming through BigQuery needs a table on Google Cloud.' },
    { when: ['remotecatalog', 'direct'], text: 'The platform that manages the tables does the writing. Google Cloud reads them in place.' },
    { when: ['hivemigrate', 'finegrained'], text: 'Hive tables only have IAM permissions. For row filters and masking, convert the tables to Iceberg in the runtime catalog.' },
    { when: ['othercloud', 'direct'], text: 'Engines on Google Cloud only read data that stays in another cloud. The platform that owns it does the writing.' },
  ];

  /** @type {{ label: string, url: string }[]} */
  const SOURCES = [
    { label: 'Introduction to BigQuery tables', url: DOCS + '/bigquery/docs/tables-intro' },
    { label: 'Apache Iceberg managed tables', url: DOCS + '/bigquery/docs/biglake-iceberg-tables-in-bigquery' },
    { label: 'BigLake tables', url: DOCS + '/bigquery/docs/biglake-intro' },
    { label: 'Apache Iceberg external tables', url: DOCS + '/bigquery/docs/iceberg-external-tables' },
    { label: 'Object tables', url: DOCS + '/bigquery/docs/object-table-introduction' },
    { label: 'Lakehouse runtime catalog', url: DOCS + '/lakehouse/docs/about-lakehouse-catalogs' },
    { label: 'Custom Iceberg catalog for BigQuery (Legacy)', url: DOCS + '/lakehouse/docs/about-custom-iceberg-catalog-endpoint' },
    { label: 'Row-level and column-level security for Iceberg tables', url: DOCS + '/lakehouse/docs/fine-grained-access-control' },
    { label: 'Apache Hive catalog endpoint', url: DOCS + '/lakehouse/docs/about-spark-hive-metastore' },
    { label: 'Cross-cloud data access', url: DOCS + '/lakehouse/docs/about-cross-cloud-data-access' },
  ];

  const DATA = { NEED_GROUPS, NEEDS, TYPES, TIPS, SOURCES, CHECKED_ON: '23 November 2026' };

  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else /** @type {any} */ (root).TABLE_DATA = DATA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
