import { IsUrl } from 'class-validator';

export class AddPhotoDto {
  @IsUrl()
  url: string;
}
