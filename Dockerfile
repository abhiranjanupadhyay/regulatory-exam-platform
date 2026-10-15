# One image definition for every backend service: docker build --build-arg MODULE=user-service .
FROM maven:3.9-eclipse-temurin-17 AS build
ARG MODULE
WORKDIR /src
COPY . .
RUN mvn -q -pl ${MODULE} -am -DskipTests package

FROM eclipse-temurin:17-jre
ARG MODULE
WORKDIR /app
COPY --from=build /src/${MODULE}/target/${MODULE}-1.0.0-SNAPSHOT.jar app.jar
# Render injects PORT; fall back to 8080 for local runs.
CMD ["sh", "-c", "java -Dserver.port=${PORT:-8080} -jar app.jar"]
