import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * Validated query for GET /api/transactions. Property names match the query keys
 * (snake_case) the frontend already sends. With the global ValidationPipe this
 * rejects a malformed `brand`, coerces `page`/`size` to positive integers, and
 * strips unknown keys — the first controller to adopt DTO validation; extend the
 * same pattern to the other cross-vendor queries.
 */
export class TransactionsQueryDto {
  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;

  @IsOptional()
  @IsIn(['ALL', 'OKKO', 'SHELL'])
  brand?: 'ALL' | 'OKKO' | 'SHELL';

  @IsOptional()
  @IsString()
  trans_type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  size?: number;
}
