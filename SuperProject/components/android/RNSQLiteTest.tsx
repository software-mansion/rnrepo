import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { openDatabase, SQLiteDatabase } from 'react-native-sqlite-storage';

// Function to get a database connection
export const getDBConnection = async () => {
  try {
    return await openDatabase({name: 'todo-data.db', location: 'default'});
  } catch (error) {
    console.error(error);
    throw new Error('Failed to open database');
  }
};

// Function to create a table if it doesn't exist
export const createTable = async (db: SQLiteDatabase, tableName: string) => {
  const query = `CREATE TABLE IF NOT EXISTS ${tableName}(
      value TEXT NOT NULL
  );`;
  await db.executeSql(query);
};

const RNSQLiteTest = () => {
  useEffect(() => {
    const initializeDB = async () => {
      try {
        // Get connection and create table
        const db = await getDBConnection();
        await createTable(db, 'ExampleTable');

        console.log('Database is ready');
      } catch (error) {
        console.error('Error initializing database:', error);
      }
    };

    initializeDB();
  }, []);

  return (
    <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
      <Text>React Native SQLite Test!</Text>
    </View>
  );
};

export default RNSQLiteTest;