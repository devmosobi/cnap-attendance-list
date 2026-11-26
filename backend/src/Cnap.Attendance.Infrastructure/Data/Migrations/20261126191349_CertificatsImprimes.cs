using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cnap.Attendance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class CertificatsImprimes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "certificats_imprimes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    seminaire_id = table.Column<Guid>(type: "uuid", nullable: false),
                    type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    cle = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    imprime_le = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    imprime_par = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_certificats_imprimes", x => x.id);
                    table.CheckConstraint("ck_certificats_imprimes_type", "type IN ('Participant', 'Club')");
                    table.ForeignKey(
                        name: "fk_certificats_imprimes_seminaires_seminaire_id",
                        column: x => x.seminaire_id,
                        principalTable: "seminaires",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ux_certificats_imprimes",
                table: "certificats_imprimes",
                columns: new[] { "seminaire_id", "type", "cle" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "certificats_imprimes");
        }
    }
}
