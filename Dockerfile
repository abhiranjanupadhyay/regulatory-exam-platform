# Fallback image that works with Render's default "./Dockerfile" path.
# Builds every service; the one that runs is chosen at runtime by the MODULE env var
# (user-service, subscription-service, content-service, assessment-service, api-gateway).
# render.yaml uses the leaner per-service files in docker/ instead.
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /src
COPY . .
RUN mvn -q -DskipTests package

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /src/user-service/target/user-service-1.0.0-SNAPSHOT.jar user-service.jar
COPY --from=build /src/subscription-service/target/subscription-service-1.0.0-SNAPSHOT.jar subscription-service.jar
COPY --from=build /src/content-service/target/content-service-1.0.0-SNAPSHOT.jar content-service.jar
COPY --from=build /src/assessment-service/target/assessment-service-1.0.0-SNAPSHOT.jar assessment-service.jar
COPY --from=build /src/api-gateway/target/api-gateway-1.0.0-SNAPSHOT.jar api-gateway.jar
CMD ["sh", "-c", "test -n \"$MODULE\" || { echo 'MODULE env var is required'; exit 1; }; exec java -Dserver.port=${PORT:-8080} -jar /app/${MODULE}.jar"]
