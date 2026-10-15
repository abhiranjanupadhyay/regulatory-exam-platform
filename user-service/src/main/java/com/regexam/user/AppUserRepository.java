package com.regexam.user;

import java.util.Optional;
import org.springframework.data.neo4j.repository.Neo4jRepository;

public interface AppUserRepository extends Neo4jRepository<AppUser, String> {
    Optional<AppUser> findByEmail(String email);

    Optional<AppUser> findByMobile(String mobile);
}
