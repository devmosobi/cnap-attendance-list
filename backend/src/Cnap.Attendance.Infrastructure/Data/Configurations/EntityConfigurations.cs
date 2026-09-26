using Cnap.Attendance.Core.Entities;
using Cnap.Attendance.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Cnap.Attendance.Infrastructure.Data.Configurations;

public class SeminaireConfiguration : IEntityTypeConfiguration<Seminaire>
{
    public void Configure(EntityTypeBuilder<Seminaire> b)
    {
        b.ToTable("seminaires", t =>
        {
            t.HasCheckConstraint("ck_seminaires_inscrits_declares", "inscrits_declares IS NULL OR inscrits_declares >= 0");
            t.HasCheckConstraint("ck_seminaires_rayon", $"rayon_metres BETWEEN {Seminaire.RayonMinimumMetres} AND {Seminaire.RayonMaximumMetres}");
            t.HasCheckConstraint("ck_seminaires_controle_position",
                "controle_position = 'Desactive' OR (latitude IS NOT NULL AND longitude IS NOT NULL)");
        });
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasDefaultValueSql("gen_random_uuid()");
        b.Property(x => x.Designation).HasMaxLength(200).IsRequired();
        b.Property(x => x.EstActif).HasDefaultValue(false).ValueGeneratedNever();
        b.Property(x => x.ControlePosition).HasConversion<string>().HasMaxLength(20)
            .HasDefaultValue(ControlePosition.Desactive).ValueGeneratedNever();
        b.Property(x => x.RayonMetres).HasDefaultValue(200).ValueGeneratedNever();
        b.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
        b.Property(x => x.UpdatedAt).HasDefaultValueSql("now()");
        b.HasIndex(x => x.EstActif);
    }
}

public class SessionConfiguration : IEntityTypeConfiguration<Session>
{
    public void Configure(EntityTypeBuilder<Session> b)
    {
        b.ToTable("sessions", t => t.HasCheckConstraint("ck_sessions_plage_horaire", "heure_fin > heure_debut"));
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasDefaultValueSql("gen_random_uuid()");
        b.Property(x => x.Designation).HasMaxLength(200).IsRequired();
        b.Property(x => x.EstActif).HasDefaultValue(false).ValueGeneratedNever();
        b.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
        b.Property(x => x.UpdatedAt).HasDefaultValueSql("now()");
        b.HasOne(x => x.Seminaire).WithMany(s => s.Sessions).HasForeignKey(x => x.SeminaireId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.SeminaireId, x.EstActif });
    }
}

public class ClubConfiguration : IEntityTypeConfiguration<Club>
{
    public void Configure(EntityTypeBuilder<Club> b)
    {
        b.ToTable("clubs", t => t.HasCheckConstraint("ck_clubs_type", "type IN ('Rotary', 'Rotaract', 'Interact', 'Autre')"));
        b.HasKey(x => x.Code);
        b.Property(x => x.Code).HasMaxLength(20);
        b.Property(x => x.Nom).HasMaxLength(200).IsRequired();
        b.Property(x => x.Type).HasConversion<string>().HasMaxLength(20).HasDefaultValue(TypeClub.Autre).ValueGeneratedNever();
        b.Property(x => x.EstActif).HasDefaultValue(true).ValueGeneratedNever();
        b.HasIndex(x => x.Type);
        b.HasIndex(x => x.Nom).IsUnique();
    }
}

public class QrCodeConfiguration : IEntityTypeConfiguration<QrCode>
{
    public void Configure(EntityTypeBuilder<QrCode> b)
    {
        b.ToTable("qr_codes", t =>
        {
            t.HasCheckConstraint("ck_qr_codes_format", "code ~ '^[A-Z0-9]{20}$'");
            t.HasCheckConstraint("ck_qr_codes_statut", "statut IN ('Inactif', 'Actif')");
            t.HasCheckConstraint("ck_qr_codes_actif_complet",
                "statut = 'Inactif' OR (nom_complet IS NOT NULL AND email IS NOT NULL AND club_code IS NOT NULL AND seminaire_id IS NOT NULL AND date_activation IS NOT NULL)");
        });
        b.HasKey(x => x.Code);
        b.Property(x => x.Code).HasMaxLength(20);
        b.Property(x => x.Statut).HasConversion<string>().HasMaxLength(10).HasDefaultValue(QrCodeStatut.Inactif).ValueGeneratedNever();
        b.Property(x => x.NomComplet).HasMaxLength(200);
        b.Property(x => x.Email).HasMaxLength(254);
        b.Property(x => x.ClubCode).HasMaxLength(20);
        b.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
        b.Property(x => x.UpdatedAt).HasDefaultValueSql("now()");
        b.HasOne(x => x.Club).WithMany().HasForeignKey(x => x.ClubCode).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Seminaire).WithMany().HasForeignKey(x => x.SeminaireId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => x.Statut);
        b.HasIndex(x => x.ClubCode);
        b.HasIndex(x => x.SeminaireId);
    }
}

public class PresenceConfiguration : IEntityTypeConfiguration<Presence>
{
    public void Configure(EntityTypeBuilder<Presence> b)
    {
        b.ToTable("presences");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasDefaultValueSql("gen_random_uuid()");
        b.Property(x => x.QrCode).HasMaxLength(20);
        b.Property(x => x.HeureDePointage).HasDefaultValueSql("now()");
        b.Property(x => x.ResultatPosition).HasConversion<string>().HasMaxLength(20)
            .HasDefaultValue(ResultatPosition.NonControle).ValueGeneratedNever();
        b.Property(x => x.EstInvalidee).HasDefaultValue(false).ValueGeneratedNever();
        b.Property(x => x.MotifInvalidation).HasMaxLength(500);
        b.Property(x => x.InvalideePar).HasMaxLength(254);
        b.HasOne(x => x.QrCodeNavigation).WithMany(q => q.Presences).HasForeignKey(x => x.QrCode).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Session).WithMany(s => s.Presences).HasForeignKey(x => x.SessionId).OnDelete(DeleteBehavior.Restrict);
        // Règle métier centrale : une seule présence par QR Code et par session.
        b.HasIndex(x => new { x.QrCode, x.SessionId }).IsUnique().HasDatabaseName("ux_presences_qr_code_session");
        b.HasIndex(x => x.SessionId);
        b.HasIndex(x => x.HeureDePointage);
    }
}

public class EmailOutboxConfiguration : IEntityTypeConfiguration<EmailOutboxMessage>
{
    public void Configure(EntityTypeBuilder<EmailOutboxMessage> b)
    {
        b.ToTable("email_outbox");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasDefaultValueSql("gen_random_uuid()");
        b.Property(x => x.Destinataire).HasMaxLength(254).IsRequired();
        b.Property(x => x.DestinataireNom).HasMaxLength(200);
        b.Property(x => x.Sujet).HasMaxLength(300).IsRequired();
        b.Property(x => x.Statut).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
        b.HasOne<Presence>().WithMany().HasForeignKey(x => x.PresenceId).OnDelete(DeleteBehavior.SetNull);
        b.HasIndex(x => new { x.Statut, x.ProchaineTentativeAt });
    }
}

public class ParametresSmtpConfiguration : IEntityTypeConfiguration<ParametresSmtp>
{
    public void Configure(EntityTypeBuilder<ParametresSmtp> b)
    {
        b.ToTable("parametres_smtp", t => t.HasCheckConstraint("ck_parametres_smtp_unique", "id = 1"));
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Hote).HasMaxLength(255).IsRequired();
        b.Property(x => x.Utilisateur).HasMaxLength(255);
        b.Property(x => x.ExpediteurEmail).HasMaxLength(254).IsRequired();
        b.Property(x => x.ExpediteurNom).HasMaxLength(200).IsRequired();
    }
}

public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> b)
    {
        b.ToTable("refresh_tokens");
        b.HasKey(x => x.Id);
        b.Property(x => x.TokenHash).HasMaxLength(128).IsRequired();
        b.HasIndex(x => x.TokenHash).IsUnique();
        b.HasIndex(x => x.UserId);
        b.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class ApplicationUserConfiguration : IEntityTypeConfiguration<ApplicationUser>
{
    public void Configure(EntityTypeBuilder<ApplicationUser> b)
    {
        b.Property(x => x.NomComplet).HasMaxLength(200).IsRequired();
        b.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
    }
}
