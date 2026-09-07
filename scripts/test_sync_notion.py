import copy
import datetime as dt
import unittest
from sync_notion import complete, investment, lead


class SyncTests(unittest.TestCase):
    def test_budget_uses_previous_month_of_same_table_across_years(self):
        rows = [{'Mes': 'Enero', 'Año': 2026, 'Google': 20},
                {'Mes': 'Diciembre', 'Año': 2025, 'Presupuesto Aprobado': 600}]
        actual = investment(rows, 'hoy', 'Perú')
        self.assertEqual(actual[1]['budget'], 600)
        self.assertIsNone(actual[1]['leads'])
        self.assertEqual(actual[1]['google'], 20)

    def test_zero_budget_is_not_missing(self):
        self.assertEqual(investment([{'Mes': 'Enero', 'Año': 2026,
                                     'Presupuesto Aprobado': 0}], 'hoy')[0]['budget'], 0)

    def test_missing_history_and_duplicate_month_fail(self):
        row = {'Mes': 'Enero', 'Año': 2026}
        with self.assertRaises(ValueError):
            investment([row], 'hoy')
        row['Presupuesto Aprobado'] = 3000
        with self.assertRaises(ValueError):
            investment([row, row], 'hoy')

    def test_pagination_and_duplicates_are_required(self):
        for page in [{'results': [{'url': 'x'}], 'has_more': True},
                     {'results': [{'url': 'x'}, {'url': 'x'}], 'has_more': False},
                     {'results': [], 'has_more': False}]:
            with self.assertRaises(ValueError):
                complete(page)

    def test_lead_business_mapping_and_missing_values(self):
        row = lead({'País': '**Ecuador**', 'Empresa': '• [Empresa](url)',
                    'Estado': '["STANBY", "Propuesta Final"]',
                    'date:Fecha de envío a comercial :start': '2026-09-02'})
        self.assertEqual(row['country'], 'Colombia')
        self.assertEqual(row['company'], 'Empresa')
        self.assertEqual(row['sentDate'], '2 de septiembre de 2026')
        self.assertEqual(row['status'], 'STANBY, Propuesta Final')
        self.assertEqual(row['closeValue'], 0)
        with self.assertRaises(ValueError):
            lead({'País': 'País sin asignación'})


if __name__ == '__main__':
    unittest.main()
