FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /src
COPY . .
RUN mvn -q -pl app -am -DskipTests package

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /src/app/target/app-1.0.0-SNAPSHOT.jar app.jar
# Render injects PORT (read by application.yml); defaults to 8080 locally.
CMD ["java", "-jar", "app.jar"]
