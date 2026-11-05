<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Support\LegacySqlReader;
use PHPUnit\Framework\TestCase;
use RuntimeException;

final class LegacySqlReaderTest extends TestCase
{
    private string $path;

    protected function setUp(): void
    {
        parent::setUp();
        $path = tempnam(sys_get_temp_dir(), 'legacy_sql_');
        if ($path === false) {
            throw new RuntimeException('Cannot create SQL fixture.');
        }
        $this->path = $path;
    }

    protected function tearDown(): void
    {
        if (is_file($this->path)) {
            unlink($this->path);
        }
        parent::tearDown();
    }

    private function writeFixture(string $inserts): void
    {
        file_put_contents($this->path, "CREATE TABLE `master_opt` (\n  `id` int NOT NULL,\n  `kode_opt` varchar(50) DEFAULT NULL,\n  `nama_opt` text\n) ENGINE=InnoDB;\n".$inserts);
    }

    public function test_reads_multiple_inserts_with_explicit_column_order(): void
    {
        $this->writeFixture(<<<'SQL'
INSERT INTO `master_opt` VALUES (1, NULL, 'OPT Regresi Fixture');
INSERT INTO `master_opt` (`nama_opt`, `id`, `kode_opt`) VALUES ('Wereng', 218, 'OPT-H-000001'), ('Keong', 219, 'OPT-H-000002');
SQL);
        $rows = iterator_to_array((new LegacySqlReader)->rows($this->path, 'master_opt'));
        self::assertCount(3, $rows);
        self::assertNull($rows[0]['kode_opt']);
        self::assertSame('218', $rows[1]['id']);
        self::assertSame('Wereng', $rows[1]['nama_opt']);
        self::assertSame('OPT-H-000002', $rows[2]['kode_opt']);
    }

    public function test_preserves_quoted_delimiters_and_decodes_sql_escapes(): void
    {
        $this->writeFixture(<<<'SQL'
INSERT INTO `master_opt` VALUES (1, 'NULL', 'Daun, batang; (padi)\nFoto: petani\'s dan ''kutipan''');
SQL);
        $rows = iterator_to_array((new LegacySqlReader)->rows($this->path, 'master_opt'));
        self::assertSame('NULL', $rows[0]['kode_opt']);
        self::assertSame("Daun, batang; (padi)\nFoto: petani's dan 'kutipan'", $rows[0]['nama_opt']);
    }

    public function test_rejects_sql_expressions(): void
    {
        $this->writeFixture("INSERT INTO `master_opt` VALUES (1, NULL, CONCAT('a', 'b'));\n");
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Unsupported SQL literal');
        iterator_to_array((new LegacySqlReader)->rows($this->path, 'master_opt'));
    }

    public function test_rejects_mismatched_column_counts(): void
    {
        $this->writeFixture("INSERT INTO `master_opt` VALUES (1, NULL);\n");
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Column/value count mismatch');
        iterator_to_array((new LegacySqlReader)->rows($this->path, 'master_opt'));
    }

    public function test_rejects_unterminated_strings(): void
    {
        $this->writeFixture("INSERT INTO `master_opt` VALUES (1, NULL, 'unfinished");
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Unterminated SQL string');
        iterator_to_array((new LegacySqlReader)->rows($this->path, 'master_opt'));
    }

    public function test_rejects_tables_outside_the_reference_allowlist(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Unsupported legacy reference table');
        iterator_to_array((new LegacySqlReader)->rows($this->path, 'users'));
    }
}
