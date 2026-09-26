using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cnap.Attendance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class TypeClub : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "type",
                table: "clubs",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Autre");

            migrationBuilder.CreateIndex(
                name: "ix_clubs_type",
                table: "clubs",
                column: "type");

            migrationBuilder.AddCheckConstraint(
                name: "ck_clubs_type",
                table: "clubs",
                sql: "type IN ('Rotary', 'Rotaract', 'Interact', 'Autre')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_clubs_type",
                table: "clubs");

            migrationBuilder.DropCheckConstraint(
                name: "ck_clubs_type",
                table: "clubs");

            migrationBuilder.DropColumn(
                name: "type",
                table: "clubs");
        }
    }
}
