import { Controller, Get, Param } from '@nestjs/common';
import { OkkoApiService } from '../okko/okko-api.service';

@Controller('api/contracts')
export class ContractsController {
  constructor(private readonly okkoApiService: OkkoApiService) {}

  @Get()
  async getAllContracts() {
    return this.okkoApiService.getContracts();
  }

  @Get(':id')
  async getContractById(@Param('id') id: string) {
    const contracts = await this.okkoApiService.getContracts();
    return contracts.find(c => c.contract_id === id) || contracts[0];
  }
}
