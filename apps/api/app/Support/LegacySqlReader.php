<?php

declare(strict_types=1);

namespace App\Support;

use Generator;
use RuntimeException;

/** Reads reference INSERT values without executing legacy SQL or PHP. */
final class LegacySqlReader
{
    /** @return Generator<int, array<string, string|null>> */
    public function rows(string $path, string $table): Generator
    {
        if (! in_array($table, ['master_provinsi', 'master_kabupaten', 'master_kecamatan', 'master_desa', 'master_opt'], true)) {
            throw new RuntimeException('Unsupported legacy reference table.');
        }
        if (! is_readable($path)) {
            throw new RuntimeException('Legacy reference dump is not readable: '.$path);
        }
        $sql = file_get_contents($path);
        if ($sql === false || ! preg_match('/CREATE TABLE(?: IF NOT EXISTS)? `'.preg_quote($table, '/').'`\s*\((.*?)\)\s*ENGINE=/s', $sql, $definition)) {
            throw new RuntimeException('Missing legacy table definition: '.$table);
        }
        preg_match_all('/^\s*`([^`]+)`\s+/m', $definition[1], $columnMatches);
        $schemaColumns = $columnMatches[1];
        $pattern = '/INSERT INTO `'.preg_quote($table, '/').'`\s*(?:\(([^)]*)\)\s*)?VALUES\s*/';
        $offset = 0;
        $found = false;
        while (preg_match($pattern, $sql, $insert, PREG_OFFSET_CAPTURE, $offset)) {
            $found = true;
            $columns = $schemaColumns;
            if (isset($insert[1]) && trim($insert[1][0]) !== '') {
                preg_match_all('/`([^`]+)`/', $insert[1][0], $explicit);
                $columns = $explicit[1];
            }
            $position = $insert[0][1] + strlen($insert[0][0]);
            $length = strlen($sql);
            while ($position < $length) {
                $this->skipWhitespace($sql, $position);
                if ($position >= $length) {
                    throw new RuntimeException('Truncated INSERT for '.$table);
                }
                if ($sql[$position] === ';') {
                    $offset = $position + 1;
                    break;
                }
                if ($sql[$position] === ',') {
                    $position++;

                    continue;
                }
                if ($sql[$position] !== '(') {
                    throw new RuntimeException('Invalid tuple in '.$table.' at byte '.$position);
                }
                $position++;
                $values = [];
                while (true) {
                    $this->skipWhitespace($sql, $position);
                    $values[] = $this->value($sql, $position);
                    $this->skipWhitespace($sql, $position);
                    $delimiter = $sql[$position] ?? '';
                    $position++;
                    if ($delimiter === ')') {
                        break;
                    }
                    if ($delimiter !== ',') {
                        throw new RuntimeException('Invalid value delimiter in '.$table);
                    }
                }
                if (count($columns) !== count($values)) {
                    throw new RuntimeException('Column/value count mismatch in '.$table);
                }
                yield array_combine($columns, $values);
            }
            if ($position >= $length) {
                throw new RuntimeException('Unterminated INSERT for '.$table);
            }
        }
        if (! $found) {
            throw new RuntimeException('No reference INSERT found for '.$table);
        }
    }

    private function skipWhitespace(string $sql, int &$position): void
    {
        $length = strlen($sql);
        while ($position < $length && ctype_space($sql[$position])) {
            $position++;
        }
    }

    private function value(string $sql, int &$position): ?string
    {
        $length = strlen($sql);
        if (($sql[$position] ?? '') === "'") {
            $position++;
            $value = '';
            while ($position < $length) {
                $character = $sql[$position++];
                if ($character === '\\') {
                    if ($position >= $length) {
                        throw new RuntimeException('Truncated SQL escape.');
                    }
                    $escaped = $sql[$position++];
                    $escapeMap = ['0' => "\0", 'n' => "\n", 'r' => "\r", 't' => "\t", 'b' => "\x08", 'Z' => "\x1a"];
                    $value .= $escapeMap[$escaped] ?? $escaped;
                } elseif ($character === "'") {
                    if (($sql[$position] ?? '') === "'") {
                        $value .= "'";
                        $position++;
                    } else {
                        return $value;
                    }
                } else {
                    $value .= $character;
                }
            }
            throw new RuntimeException('Unterminated SQL string.');
        }
        $start = $position;
        while ($position < $length && $sql[$position] !== ',' && $sql[$position] !== ')') {
            $position++;
        }
        $value = trim(substr($sql, $start, $position - $start));
        if (strtoupper($value) === 'NULL') {
            return null;
        }
        if (! is_numeric($value)) {
            throw new RuntimeException('Unsupported SQL literal; expressions are never executed.');
        }

        return $value;
    }
}
