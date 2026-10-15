package com.regexam.content;

import java.util.ArrayList;
import java.util.List;

/** Minimal RFC-4180 style parser: quoted fields, escaped quotes and newlines inside quotes. */
final class Csv {
    private Csv() {
    }

    /** Pasted spreadsheet rows are tab separated; uploaded CSV files are comma separated. */
    static List<List<String>> parse(String text) {
        String firstLine = text.lines().findFirst().orElse("");
        char delimiter = firstLine.indexOf('\t') >= 0 ? '\t' : ',';
        List<List<String>> rows = new ArrayList<>();
        List<String> row = new ArrayList<>();
        StringBuilder field = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (quoted) {
                if (c == '"' && i + 1 < text.length() && text.charAt(i + 1) == '"') {
                    field.append('"');
                    i++;
                } else if (c == '"') {
                    quoted = false;
                } else {
                    field.append(c);
                }
            } else if (c == '"') {
                quoted = true;
            } else if (c == delimiter) {
                row.add(field.toString().trim());
                field.setLength(0);
            } else if (c == '\n' || c == '\r') {
                if (c == '\r' && i + 1 < text.length() && text.charAt(i + 1) == '\n') {
                    i++;
                }
                row.add(field.toString().trim());
                field.setLength(0);
                if (row.stream().anyMatch(s -> !s.isEmpty())) {
                    rows.add(row);
                }
                row = new ArrayList<>();
            } else {
                field.append(c);
            }
        }
        row.add(field.toString().trim());
        if (row.stream().anyMatch(s -> !s.isEmpty())) {
            rows.add(row);
        }
        return rows;
    }
}
