package com.regexam.user;

import org.springframework.data.neo4j.repository.Neo4jRepository;

public interface InviteCodeRepository extends Neo4jRepository<InviteCode, String> {
}
