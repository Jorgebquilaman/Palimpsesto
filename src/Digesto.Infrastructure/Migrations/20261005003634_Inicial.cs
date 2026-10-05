using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Digesto.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Inicial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .Annotation("Npgsql:PostgresExtension:unaccent", ",,");

            migrationBuilder.CreateTable(
                name: "auditoria",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    usuario = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    entidad = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    entidad_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    accion = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    antes = table.Column<string>(type: "text", nullable: true),
                    despues = table.Column<string>(type: "text", nullable: true),
                    fecha = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_auditoria", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "boletin",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    numero = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    fecha_publicacion = table.Column<DateOnly>(type: "date", nullable: false),
                    archivo_id = table.Column<Guid>(type: "uuid", nullable: true),
                    observaciones = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_boletin", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "consulta_busqueda",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    q = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    filtros = table.Column<string>(type: "text", nullable: true),
                    total = table.Column<int>(type: "integer", nullable: false),
                    ms = table.Column<int>(type: "integer", nullable: false),
                    fecha = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_consulta_busqueda", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "materia",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    padre_id = table.Column<int>(type: "integer", nullable: true),
                    nombre = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    slug = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_materia", x => x.id);
                    table.ForeignKey(
                        name: "fk_materia_materia_padre_id",
                        column: x => x.padre_id,
                        principalTable: "materia",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "organo_emisor",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    codigo = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    nombre = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    padre_id = table.Column<int>(type: "integer", nullable: true),
                    activo = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_organo_emisor", x => x.id);
                    table.ForeignKey(
                        name: "fk_organo_emisor_organo_emisor_padre_id",
                        column: x => x.padre_id,
                        principalTable: "organo_emisor",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "roles",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    normalized_name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    concurrency_stamp = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_roles", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "tipo_norma",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    codigo = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    nombre = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    alcance = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    activo = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_tipo_norma", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "usuarios",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    nombre = table.Column<string>(type: "text", nullable: false),
                    user_name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    normalized_user_name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    normalized_email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    email_confirmed = table.Column<bool>(type: "boolean", nullable: false),
                    password_hash = table.Column<string>(type: "text", nullable: true),
                    security_stamp = table.Column<string>(type: "text", nullable: true),
                    concurrency_stamp = table.Column<string>(type: "text", nullable: true),
                    phone_number = table.Column<string>(type: "text", nullable: true),
                    phone_number_confirmed = table.Column<bool>(type: "boolean", nullable: false),
                    two_factor_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    lockout_end = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    lockout_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    access_failed_count = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_usuarios", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "roles_claims",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    role_id = table.Column<string>(type: "text", nullable: false),
                    claim_type = table.Column<string>(type: "text", nullable: true),
                    claim_value = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_roles_claims", x => x.id);
                    table.ForeignKey(
                        name: "fk_roles_claims_roles_role_id",
                        column: x => x.role_id,
                        principalTable: "roles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "norma",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tipo_norma_id = table.Column<int>(type: "integer", nullable: false),
                    organo_emisor_id = table.Column<int>(type: "integer", nullable: false),
                    numero = table.Column<int>(type: "integer", nullable: false),
                    anio = table.Column<short>(type: "smallint", nullable: false),
                    sufijo = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    codigo_normalizado = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    titulo = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    resumen = table.Column<string>(type: "text", nullable: true),
                    palabras_clave = table.Column<string[]>(type: "text[]", nullable: false),
                    expediente = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    fecha_sancion = table.Column<DateOnly>(type: "date", nullable: false),
                    fecha_publicacion = table.Column<DateOnly>(type: "date", nullable: true),
                    boletin_id = table.Column<int>(type: "integer", nullable: true),
                    vigencia = table.Column<int>(type: "integer", nullable: false),
                    visibilidad = table.Column<int>(type: "integer", nullable: false),
                    estado_publicacion = table.Column<int>(type: "integer", nullable: false),
                    texto_origen = table.Column<int>(type: "integer", nullable: false),
                    calidad_ocr = table.Column<decimal>(type: "numeric", nullable: true),
                    creado_en = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    actualizado_en = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    creado_por = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    actualizado_por = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_norma", x => x.id);
                    table.ForeignKey(
                        name: "fk_norma_boletin_boletin_id",
                        column: x => x.boletin_id,
                        principalTable: "boletin",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_norma_organos_emisores_organo_emisor_id",
                        column: x => x.organo_emisor_id,
                        principalTable: "organo_emisor",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_norma_tipos_norma_tipo_norma_id",
                        column: x => x.tipo_norma_id,
                        principalTable: "tipo_norma",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "usuarios_claims",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<string>(type: "text", nullable: false),
                    claim_type = table.Column<string>(type: "text", nullable: true),
                    claim_value = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_usuarios_claims", x => x.id);
                    table.ForeignKey(
                        name: "fk_usuarios_claims_usuarios_user_id",
                        column: x => x.user_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "usuarios_logins",
                columns: table => new
                {
                    login_provider = table.Column<string>(type: "text", nullable: false),
                    provider_key = table.Column<string>(type: "text", nullable: false),
                    provider_display_name = table.Column<string>(type: "text", nullable: true),
                    user_id = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_usuarios_logins", x => new { x.login_provider, x.provider_key });
                    table.ForeignKey(
                        name: "fk_usuarios_logins_usuarios_user_id",
                        column: x => x.user_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "usuarios_roles",
                columns: table => new
                {
                    user_id = table.Column<string>(type: "text", nullable: false),
                    role_id = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_usuarios_roles", x => new { x.user_id, x.role_id });
                    table.ForeignKey(
                        name: "fk_usuarios_roles_roles_role_id",
                        column: x => x.role_id,
                        principalTable: "roles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_usuarios_roles_usuarios_user_id",
                        column: x => x.user_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "usuarios_tokens",
                columns: table => new
                {
                    user_id = table.Column<string>(type: "text", nullable: false),
                    login_provider = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    value = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_usuarios_tokens", x => new { x.user_id, x.login_provider, x.name });
                    table.ForeignKey(
                        name: "fk_usuarios_tokens_usuarios_user_id",
                        column: x => x.user_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "norma_archivo",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    norma_id = table.Column<Guid>(type: "uuid", nullable: false),
                    rol = table.Column<int>(type: "integer", nullable: false),
                    nombre_original = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    storage_key = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    mime = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    bytes = table.Column<long>(type: "bigint", nullable: false),
                    paginas = table.Column<int>(type: "integer", nullable: false),
                    firma_digital = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_norma_archivo", x => x.id);
                    table.ForeignKey(
                        name: "fk_norma_archivo_normas_norma_id",
                        column: x => x.norma_id,
                        principalTable: "norma",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "norma_fragmento",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    norma_id = table.Column<Guid>(type: "uuid", nullable: false),
                    orden = table.Column<int>(type: "integer", nullable: false),
                    tipo = table.Column<int>(type: "integer", nullable: false),
                    etiqueta = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    texto = table.Column<string>(type: "text", nullable: false),
                    html = table.Column<string>(type: "text", nullable: true),
                    pagina_desde = table.Column<int>(type: "integer", nullable: true),
                    pagina_hasta = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_norma_fragmento", x => x.id);
                    table.ForeignKey(
                        name: "fk_norma_fragmento_norma_norma_id",
                        column: x => x.norma_id,
                        principalTable: "norma",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "norma_materia",
                columns: table => new
                {
                    norma_id = table.Column<Guid>(type: "uuid", nullable: false),
                    materia_id = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_norma_materia", x => new { x.norma_id, x.materia_id });
                    table.ForeignKey(
                        name: "fk_norma_materia_materias_materia_id",
                        column: x => x.materia_id,
                        principalTable: "materia",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_norma_materia_normas_norma_id",
                        column: x => x.norma_id,
                        principalTable: "norma",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "norma_relacion",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    norma_origen_id = table.Column<Guid>(type: "uuid", nullable: false),
                    norma_destino_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tipo = table.Column<int>(type: "integer", nullable: false),
                    detalle = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_norma_relacion", x => x.id);
                    table.ForeignKey(
                        name: "fk_norma_relacion_norma_norma_destino_id",
                        column: x => x.norma_destino_id,
                        principalTable: "norma",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_norma_relacion_norma_norma_origen_id",
                        column: x => x.norma_origen_id,
                        principalTable: "norma",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "proceso_ingesta",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    norma_id = table.Column<Guid>(type: "uuid", nullable: false),
                    archivo_id = table.Column<Guid>(type: "uuid", nullable: false),
                    estado = table.Column<int>(type: "integer", nullable: false),
                    etapa = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    intentos = table.Column<int>(type: "integer", nullable: false),
                    error = table.Column<string>(type: "text", nullable: true),
                    locked_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_proceso_ingesta", x => x.id);
                    table.ForeignKey(
                        name: "fk_proceso_ingesta_norma_archivo_archivo_id",
                        column: x => x.archivo_id,
                        principalTable: "norma_archivo",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_proceso_ingesta_norma_norma_id",
                        column: x => x.norma_id,
                        principalTable: "norma",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_auditoria_entidad",
                table: "auditoria",
                columns: new[] { "entidad", "entidad_id" });

            migrationBuilder.CreateIndex(
                name: "ix_auditoria_fecha",
                table: "auditoria",
                column: "fecha");

            migrationBuilder.CreateIndex(
                name: "ix_boletin_numero",
                table: "boletin",
                column: "numero",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_consulta_busqueda_fecha",
                table: "consulta_busqueda",
                column: "fecha");

            migrationBuilder.CreateIndex(
                name: "ix_materia_padre_id",
                table: "materia",
                column: "padre_id");

            migrationBuilder.CreateIndex(
                name: "ix_materia_slug",
                table: "materia",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_norma_anio_numero",
                table: "norma",
                columns: new[] { "anio", "numero" });

            migrationBuilder.CreateIndex(
                name: "ix_norma_boletin_id",
                table: "norma",
                column: "boletin_id");

            migrationBuilder.CreateIndex(
                name: "ix_norma_codigo_normalizado",
                table: "norma",
                column: "codigo_normalizado",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_norma_estado_publicacion",
                table: "norma",
                column: "estado_publicacion");

            migrationBuilder.CreateIndex(
                name: "ix_norma_fecha_sancion",
                table: "norma",
                column: "fecha_sancion");

            migrationBuilder.CreateIndex(
                name: "ix_norma_organo_emisor_id",
                table: "norma",
                column: "organo_emisor_id");

            migrationBuilder.CreateIndex(
                name: "ix_norma_tipo_norma_id",
                table: "norma",
                column: "tipo_norma_id");

            migrationBuilder.CreateIndex(
                name: "ix_norma_visibilidad",
                table: "norma",
                column: "visibilidad");

            migrationBuilder.CreateIndex(
                name: "ix_norma_archivo_norma_id",
                table: "norma_archivo",
                column: "norma_id");

            migrationBuilder.CreateIndex(
                name: "ix_norma_archivo_sha256",
                table: "norma_archivo",
                column: "sha256");

            migrationBuilder.CreateIndex(
                name: "ix_fragmento_norma",
                table: "norma_fragmento",
                columns: new[] { "norma_id", "orden" });

            migrationBuilder.CreateIndex(
                name: "ix_norma_materia_materia_id",
                table: "norma_materia",
                column: "materia_id");

            migrationBuilder.CreateIndex(
                name: "ix_norma_relacion_norma_destino_id",
                table: "norma_relacion",
                column: "norma_destino_id");

            migrationBuilder.CreateIndex(
                name: "ix_norma_relacion_unica",
                table: "norma_relacion",
                columns: new[] { "norma_origen_id", "norma_destino_id", "tipo" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_organo_emisor_codigo",
                table: "organo_emisor",
                column: "codigo",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_organo_emisor_padre_id",
                table: "organo_emisor",
                column: "padre_id");

            migrationBuilder.CreateIndex(
                name: "ix_proceso_ingesta_archivo_id",
                table: "proceso_ingesta",
                column: "archivo_id");

            migrationBuilder.CreateIndex(
                name: "ix_proceso_ingesta_cola",
                table: "proceso_ingesta",
                columns: new[] { "estado", "id" });

            migrationBuilder.CreateIndex(
                name: "ix_proceso_ingesta_norma_id",
                table: "proceso_ingesta",
                column: "norma_id");

            migrationBuilder.CreateIndex(
                name: "RoleNameIndex",
                table: "roles",
                column: "normalized_name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_roles_claims_role_id",
                table: "roles_claims",
                column: "role_id");

            migrationBuilder.CreateIndex(
                name: "ix_tipo_norma_codigo",
                table: "tipo_norma",
                column: "codigo",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "EmailIndex",
                table: "usuarios",
                column: "normalized_email");

            migrationBuilder.CreateIndex(
                name: "UserNameIndex",
                table: "usuarios",
                column: "normalized_user_name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_usuarios_claims_user_id",
                table: "usuarios_claims",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_usuarios_logins_user_id",
                table: "usuarios_logins",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_usuarios_roles_role_id",
                table: "usuarios_roles",
                column: "role_id");

            migrationBuilder.Sql("""
                CREATE TEXT SEARCH CONFIGURATION es_unaccent (COPY = spanish);
                ALTER TEXT SEARCH CONFIGURATION es_unaccent
                  ALTER MAPPING FOR hword, hword_part, word WITH unaccent, spanish_stem;

                CREATE TEXT SEARCH CONFIGURATION simple_unaccent (COPY = simple);
                ALTER TEXT SEARCH CONFIGURATION simple_unaccent
                  ALTER MAPPING FOR hword, hword_part, word WITH unaccent, simple;
                """);

            migrationBuilder.Sql("""
                ALTER TABLE norma_fragmento
                  ADD COLUMN tsv_es  tsvector GENERATED ALWAYS AS (to_tsvector('es_unaccent',     coalesce(texto,''))) STORED,
                  ADD COLUMN tsv_lit tsvector GENERATED ALWAYS AS (to_tsvector('simple_unaccent', coalesce(texto,''))) STORED;

                CREATE INDEX ix_fragmento_tsv_es  ON norma_fragmento USING gin (tsv_es);
                CREATE INDEX ix_fragmento_tsv_lit ON norma_fragmento USING gin (tsv_lit);
                """);

            migrationBuilder.Sql("""
                CREATE OR REPLACE FUNCTION f_unir(text[]) RETURNS text
                LANGUAGE sql IMMUTABLE STRICT AS
                $$ SELECT array_to_string($1, ' ') $$;
                """);

            migrationBuilder.Sql("""
                ALTER TABLE norma
                  ADD COLUMN tsv_meta tsvector GENERATED ALWAYS AS (
                    setweight(to_tsvector('es_unaccent', codigo_normalizado || ' ' || titulo), 'A')
                    || setweight(to_tsvector('es_unaccent', coalesce(resumen,'') || ' ' || f_unir(palabras_clave)), 'B')
                  ) STORED;

                CREATE INDEX ix_norma_tsv_meta    ON norma USING gin (tsv_meta);
                CREATE INDEX ix_norma_titulo_trgm ON norma USING gin (titulo gin_trgm_ops);
                CREATE INDEX ix_norma_codigo_trgm ON norma USING gin (codigo_normalizado gin_trgm_ops);
                """);

            migrationBuilder.Sql("""
                CREATE UNIQUE INDEX ix_norma_unicidad
                  ON norma (tipo_norma_id, organo_emisor_id, numero, anio, coalesce(sufijo, ''));
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "auditoria");

            migrationBuilder.DropTable(
                name: "consulta_busqueda");

            migrationBuilder.DropTable(
                name: "norma_fragmento");

            migrationBuilder.DropTable(
                name: "norma_materia");

            migrationBuilder.DropTable(
                name: "norma_relacion");

            migrationBuilder.DropTable(
                name: "proceso_ingesta");

            migrationBuilder.DropTable(
                name: "roles_claims");

            migrationBuilder.DropTable(
                name: "usuarios_claims");

            migrationBuilder.DropTable(
                name: "usuarios_logins");

            migrationBuilder.DropTable(
                name: "usuarios_roles");

            migrationBuilder.DropTable(
                name: "usuarios_tokens");

            migrationBuilder.DropTable(
                name: "materia");

            migrationBuilder.DropTable(
                name: "norma_archivo");

            migrationBuilder.DropTable(
                name: "roles");

            migrationBuilder.DropTable(
                name: "usuarios");

            migrationBuilder.DropTable(
                name: "norma");

            migrationBuilder.DropTable(
                name: "boletin");

            migrationBuilder.DropTable(
                name: "organo_emisor");

            migrationBuilder.DropTable(
                name: "tipo_norma");

            migrationBuilder.Sql("DROP TEXT SEARCH CONFIGURATION IF EXISTS es_unaccent;");
            migrationBuilder.Sql("DROP TEXT SEARCH CONFIGURATION IF EXISTS simple_unaccent;");
        }
    }
}
