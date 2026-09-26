using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cnap.Attendance.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class InvalidationPresence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "est_invalidee",
                table: "presences",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "invalidee_le",
                table: "presences",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "invalidee_par",
                table: "presences",
                type: "character varying(254)",
                maxLength: 254,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "motif_invalidation",
                table: "presences",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "est_invalidee",
                table: "presences");

            migrationBuilder.DropColumn(
                name: "invalidee_le",
                table: "presences");

            migrationBuilder.DropColumn(
                name: "invalidee_par",
                table: "presences");

            migrationBuilder.DropColumn(
                name: "motif_invalidation",
                table: "presences");
        }
    }
}
