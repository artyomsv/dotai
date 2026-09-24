---
paths:
  - "**/*Version*.java"
  - "**/*version*.xml"
  - "**/*_version*"
  - "**/changelog/sql/create_*_version*.sql"
---

# DB-Trigger Entity Versioning Pattern

Use this pattern when an entity's historical state must be preserved across mutations (e.g., questions assigned to interviews, prompts used in AI executions).

## How it works

1. Add `@Version Integer version = 0` to the parent entity — Hibernate manages it as an optimistic lock and increments it on every UPDATE.
2. Create a `*_version` table with all mutable columns from the parent + `version_number INTEGER NOT NULL`, `captured_at TIMESTAMP NOT NULL`. No separate PK sequence needed — use `gen_random_uuid()`.
3. Write a PostgreSQL `AFTER INSERT OR UPDATE` trigger that inserts a full snapshot using `NEW.version` as `version_number`. No application code involvement.
4. SQL files live in `changelog/sql/`, referenced from Liquibase via `<sqlFile splitStatements="false">`.

## Parent entity

```java
@Version
@Column(name = "version", nullable = false)
private Integer version = 0;
```

`@Version` serves two purposes simultaneously: optimistic locking (concurrent update protection) and version number source for snapshots.

## Trigger function skeleton

```sql
CREATE OR REPLACE FUNCTION capture_<entity>_version()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO <entity>_version (
        id, <parent_id_col>, version_number, <...all mutable columns...>, captured_at
    ) VALUES (
        gen_random_uuid(), NEW.id, NEW.version, <...NEW.<col>...>, NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Trigger registration:
```sql
CREATE TRIGGER trg_<entity>_version
    AFTER INSERT OR UPDATE ON <entity>
    FOR EACH ROW EXECUTE FUNCTION capture_<entity>_version();
```

## Liquibase changeset

```xml
<changeSet id="YYYYMMDDHHMMSS-N" author="service">
  <sqlFile path="config/liquibase/shared/changelog/sql/create_<entity>_version_function.sql"
           relativeToChangelogFile="false" splitStatements="false"/>
  <sqlFile path="config/liquibase/shared/changelog/sql/create_<entity>_version_trigger.sql"
           relativeToChangelogFile="false" splitStatements="false"/>
  <rollback>
    <sql>
      DROP TRIGGER IF EXISTS trg_<entity>_version ON <entity>;
      DROP FUNCTION IF EXISTS capture_<entity>_version();
    </sql>
  </rollback>
</changeSet>
```

## Version table constraints

- Unique constraint on `(parent_id_col, version_number)` — one snapshot per version per entity.
- **No FK** from version table to parent — snapshots survive parent deletion.
- Indexes: `(parent_id_col)`, `(parent_id_col, version_number)`.

## Version entity isolation

| Parent isolation | Version entity | DAO requirement |
|---|---|---|
| `@SystemEntity` | `@SystemEntity` | Single `AbstractDao`-based DAO only |
| `@IsolationPolicy(ORG_SHARED)` + `TenantScoped` | Same | Full pair: `AbstractDao` + `AbstractMultiTenantDao` |

The `TenantScoped` version entity's user-protected DAO uses `OrganizationContext.getCurrentOrganizationId()` to scope `findByParentId` queries by `organizationId`.

## Version entity class

- No `@Version` annotation (snapshots are immutable, written only by the trigger).
- No `@EntityListeners(AuditingEntityListener.class)` — audit fields are copied from the parent row by the trigger.
- Embedded types (e.g., `@Embedded QuestionVerification`) are **not** reused — store their columns flat since the trigger writes them directly.

## Reference implementations

- `ai/src/main/resources/config/liquibase/shared/changelog/sql/create_prompt_version_function.sql` — AI Prompt versioning
- `questions/src/main/resources/config/liquibase/shared/changelog/sql/create_library_question_version_function.sql` — LibraryQuestion versioning
- `questions/src/main/resources/config/liquibase/shared/changelog/sql/create_global_question_version_function.sql` — GlobalQuestion versioning
