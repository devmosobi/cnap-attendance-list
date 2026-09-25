using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cnap.Attendance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class ControlePosition : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "controle_position",
                table: "seminaires",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Desactive");

            migrationBuilder.AddColumn<double>(
                name: "latitude",
                table: "seminaires",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "longitude",
                table: "seminaires",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "rayon_metres",
                table: "seminaires",
                type: "integer",
                nullable: false,
                defaultValue: 200);

            migrationBuilder.AddColumn<int>(
                name: "distance_metres",
                table: "presences",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "precision_metres",
                table: "presences",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "resultat_position",
                table: "presences",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "NonControle");

            migrationBuilder.AddCheckConstraint(
                name: "ck_seminaires_controle_position",
                table: "seminaires",
                sql: "controle_position = 'Desactive' OR (latitude IS NOT NULL AND longitude IS NOT NULL)");

            migrationBuilder.AddCheckConstraint(
                name: "ck_seminaires_rayon",
                table: "seminaires",
                sql: "rayon_metres BETWEEN 50 AND 500");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_seminaires_controle_position",
                table: "seminaires");

            migrationBuilder.DropCheckConstraint(
                name: "ck_seminaires_rayon",
                table: "seminaires");

            migrationBuilder.DropColumn(
                name: "controle_position",
                table: "seminaires");

            migrationBuilder.DropColumn(
                name: "latitude",
                table: "seminaires");

            migrationBuilder.DropColumn(
                name: "longitude",
                table: "seminaires");

            migrationBuilder.DropColumn(
                name: "rayon_metres",
                table: "seminaires");

            migrationBuilder.DropColumn(
                name: "distance_metres",
                table: "presences");

            migrationBuilder.DropColumn(
                name: "precision_metres",
                table: "presences");

            migrationBuilder.DropColumn(
                name: "resultat_position",
                table: "presences");
        }
    }
}
