using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Digesto.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class IndiceTexto : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
                LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS
                $$ SELECT unaccent('unaccent', $1) $$;

                CREATE OR REPLACE FUNCTION f_unir(text[]) RETURNS text
                LANGUAGE sql IMMUTABLE AS
                $$ SELECT coalesce(array_to_string($1, ' '), '') $$;
                """);

            migrationBuilder.Sql("""
                ALTER TABLE norma_fragmento
                  ADD COLUMN tsv_es tsvector GENERATED ALWAYS AS (
                    to_tsvector('spanish', coalesce(texto,''))
                    || to_tsvector('spanish', f_unaccent(coalesce(texto,''))
                  )) STORED,
                  ADD COLUMN tsv_lit tsvector GENERATED ALWAYS AS (to_tsvector('simple', f_unaccent(coalesce(texto,'')))) STORED;

                CREATE INDEX ix_fragmento_tsv_es  ON norma_fragmento USING gin (tsv_es);
                CREATE INDEX ix_fragmento_tsv_lit ON norma_fragmento USING gin (tsv_lit);
                """);

            migrationBuilder.Sql("""
                ALTER TABLE norma
                  ADD COLUMN tsv_meta tsvector GENERATED ALWAYS AS (
                    setweight(to_tsvector('spanish', codigo_normalizado || ' ' || titulo), 'A')
                    || setweight(to_tsvector('spanish', f_unaccent(codigo_normalizado || ' ' || titulo)), 'A')
                    || setweight(to_tsvector('spanish', coalesce(resumen,'') || ' ' || f_unir(palabras_clave)), 'B')
                    || setweight(to_tsvector('spanish', f_unaccent(coalesce(resumen,'') || ' ' || f_unir(palabras_clave))), 'B')
                  ) STORED;

                CREATE INDEX ix_norma_tsv_meta    ON norma USING gin (tsv_meta);
                CREATE INDEX ix_norma_titulo_trgm ON norma USING gin (titulo gin_trgm_ops);
                CREATE INDEX ix_norma_codigo_trgm ON norma USING gin (codigo_normalizado gin_trgm_ops);
                """);

            migrationBuilder.Sql("""
                CREATE UNIQUE INDEX ix_norma_unicidad
                  ON norma (tipo_norma_id, organo_emisor_id, numero, anio, coalesce(sufijo, ''))
                  WHERE numero > 0;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_norma_unicidad;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_norma_codigo_trgm;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_norma_titulo_trgm;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_norma_tsv_meta;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_fragmento_tsv_lit;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_fragmento_tsv_es;");
            migrationBuilder.Sql("""
                ALTER TABLE norma DROP COLUMN IF EXISTS tsv_meta;
                """);
            migrationBuilder.Sql("""
                ALTER TABLE norma_fragmento DROP COLUMN IF EXISTS tsv_lit;
                ALTER TABLE norma_fragmento DROP COLUMN IF EXISTS tsv_es;
                """);
            migrationBuilder.Sql("DROP FUNCTION IF EXISTS f_unir(text[]);");
            migrationBuilder.Sql("DROP FUNCTION IF EXISTS f_unaccent(text);");
        }
    }
}
