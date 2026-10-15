FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /src
COPY . .
RUN mvn -q -pl subscription-service -am -DskipTests package

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /src/subscription-service/target/subscription-service-1.0.0-SNAPSHOT.jar app.jar
# Render injects PORT; fall back to 8080 for local runs.
CMD ["sh", "-c", "java -Dserver.port=${PORT:-8080} -jar app.jar"]
