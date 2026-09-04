import udkAdpCsv from './adp/UDK - ADP Comparison - Fantasy Footballers Podcast - 2026-08-31_12-05-31_PDT.csv?raw';

export type UdkAdpSource = {
  name: string;
  fileName: string;
  capturedAt: string;
  teamCount: number;
  column: 'Avg';
  csv: string;
};

export const UDK_ADP_SOURCE: UdkAdpSource = {
  name: 'Fantasy Footballers UDK ADP Comparison',
  fileName: 'UDK - ADP Comparison - Fantasy Footballers Podcast - 2026-08-31_12-05-31_PDT.csv',
  capturedAt: '2026-08-31T12:05:31-07:00',
  teamCount: 12,
  column: 'Avg',
  csv: udkAdpCsv,
};
