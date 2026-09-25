# syntax=docker/dockerfile:1

# --- Build ---
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Restauration en couche séparée : réutilisée tant que les .csproj ne changent pas.
COPY Cnap.Attendance.sln ./
COPY src/Cnap.Attendance.Core/Cnap.Attendance.Core.csproj src/Cnap.Attendance.Core/
COPY src/Cnap.Attendance.Infrastructure/Cnap.Attendance.Infrastructure.csproj src/Cnap.Attendance.Infrastructure/
COPY src/Cnap.Attendance.Api/Cnap.Attendance.Api.csproj src/Cnap.Attendance.Api/
RUN dotnet restore src/Cnap.Attendance.Api/Cnap.Attendance.Api.csproj

COPY src/ src/
RUN dotnet publish src/Cnap.Attendance.Api/Cnap.Attendance.Api.csproj -c Release -o /app --no-restore /p:UseAppHost=false

# --- Runtime ---
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    TZ=Africa/Abidjan
COPY --from=build /app .
USER app
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 CMD curl -fs http://localhost:8080/api/health || exit 1
ENTRYPOINT ["dotnet", "Cnap.Attendance.Api.dll"]
